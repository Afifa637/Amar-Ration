import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import {
  createDistributionSession,
  closeDistributionSession,
  completeDistribution,
  downloadReceipt,
  generateReceipt,
  getDistributionRecords,
  getDistributionSessions,
  getNotifications,
  getConsumerPhotoVerify,
  getStockSummary,
  getDistributionStats,
  getDistributionTokens,
  joinQueue,
  markNotificationAsRead,
  startDistributionSession,
  uploadConsumerPhoto,
  type NotificationItem,
  type DistributionRecord,
  type DistributionSession,
  type DistributionToken,
} from "../../services/api";

const STOCK_ITEMS = ["চাল", "ডাল", "পেঁয়াজ"] as const;

function itemQtyText(map?: Record<string, number>) {
  if (!map) return "চাল: 0, ডাল: 0, পেঁয়াজ: 0";
  return STOCK_ITEMS.map(
    (item) => `${item}: ${(map[item] || 0).toFixed(2)} kg`,
  ).join(" | ");
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(s: string) {
  return (
    (
      {
        Active: "সক্রিয়",
        Inactive: "নিষ্ক্রিয়",
        Suspended: "স্থগিত",
        Pending: "অপেক্ষমাণ",
        Revoked: "বাতিল",
        Open: "চলমান",
        Closed: "বন্ধ",
        Planned: "পরিকল্পিত",
        Paused: "স্থগিত",
        Issued: "ইস্যুড",
        Used: "ব্যবহৃত",
        Cancelled: "বাতিল",
        Expired: "মেয়াদোত্তীর্ণ",
      } as Record<string, string>
    )[s] ?? s
  );
}

export default function StockDistributionPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<DistributionRecord[]>([]);
  const [tokens, setTokens] = useState<DistributionToken[]>([]);
  const [stats, setStats] = useState({
    totalTokens: 0,
    issued: 0,
    used: 0,
    cancelled: 0,
    mismatches: 0,
    completedRecords: 0,
    expectedKg: 0,
    actualKg: 0,
    byItem: {} as Record<
      string,
      { expectedKg: number; actualKg: number; mismatchCount: number }
    >,
    totals: undefined as
      | { expectedKg: number; actualKg: number; label?: string }
      | undefined,
  });
  const [stockOutKg, setStockOutKg] = useState(0);
  const [stockInKg, setStockInKg] = useState(0);
  const [stockBalanceKg, setStockBalanceKg] = useState(0);
  const [stockByItem, setStockByItem] = useState<
    Record<string, { stockInKg: number; stockOutKg: number; balanceKg: number }>
  >({});
  const [sessions, setSessions] = useState<DistributionSession[]>([]);
  const [openSession, setOpenSession] = useState<DistributionSession | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"সব" | "Issued" | "Used" | "Cancelled">(
    "সব",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openComplete, setOpenComplete] = useState(false);
  const [selectedToken, setSelectedToken] = useState<DistributionToken | null>(
    null,
  );
  const [actualKg, setActualKg] = useState(0);
  const [mismatchAlerts, setMismatchAlerts] = useState<NotificationItem[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>("");
  const [todayStockTotal, setTodayStockTotal] = useState<number>(0);
  const [statsByItem, setStatsByItem] = useState<
    Record<
      string,
      { expectedKg: number; actualKg: number; mismatchCount: number }
    >
  >({});
  const [stockContext, setStockContext] = useState<{
    division?: string;
    ward?: string;
    sessionId?: string | null;
    sessionCode?: string;
    sessionStatus?: string | null;
  }>({});
  const [refreshing, setRefreshing] = useState(false);
  const [plannedDateKey, setPlannedDateKey] = useState(todayDateKey());
  const [photoVerified, setPhotoVerified] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [queueMsg, setQueueMsg] = useState("");

  const loadMismatchAlerts = async () => {
    try {
      const data = await getNotifications({
        status: "Unread",
        page: 1,
        limit: 6,
      });
      const filtered = (data.items || []).filter((item: NotificationItem) => {
        const text = `${item.title} ${item.message}`.toLowerCase();
        return (
          text.includes("mismatch") ||
          text.includes("ওজন") ||
          text.includes("weight")
        );
      });
      setMismatchAlerts(filtered);
    } catch {
      // ignore notification polling failures
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const sessionData = await getDistributionSessions({ limit: 50 });

      const allSessions = sessionData.sessions || [];
      setSessions(allSessions);

      const currentSession =
        allSessions.find((s) => s.status === "Open") ||
        allSessions.find((s) => s.status === "Paused") ||
        allSessions.find((s) => s.status === "Planned") ||
        null;

      const liveSessionId =
        currentSession && ["Open", "Paused"].includes(currentSession.status)
          ? currentSession._id
          : undefined;

      const stockData = await getStockSummary({
        dateKey: currentSession?.dateKey,
      });

      const [tokenData, recordData, statData] = liveSessionId
        ? await Promise.all([
            getDistributionTokens({ limit: 300, sessionId: liveSessionId }),
            getDistributionRecords({ limit: 300, sessionId: liveSessionId }),
            getDistributionStats({ sessionId: liveSessionId }),
          ])
        : [
            { tokens: [] },
            {
              records: [],
              stock: { dateKey: stockData.dateKey, stockOutKg: 0, byItem: {} },
            },
            {
              totalTokens: 0,
              issued: 0,
              used: 0,
              cancelled: 0,
              mismatches: 0,
              completedRecords: 0,
              expectedKg: 0,
              actualKg: 0,
              byItem: {},
            },
          ];

      setTokens(tokenData.tokens);
      setRecords(recordData.records);
      setStats((prev) => ({
        ...prev,
        ...statData,
        byItem: statData.byItem || {},
        totals: statData.totals,
      }));
      setStockOutKg(recordData.stock.stockOutKg);
      setStockInKg(stockData.summary.stockInKg);
      setStockBalanceKg(stockData.summary.balanceKg);
      setStockByItem(stockData.byItem || {});
      setStatsByItem(statData.byItem || {});
      setStockContext(stockData.context || {});
      setOpenSession(currentSession);
      setSessionStatus(currentSession?.status || "");
      setTodayStockTotal(Number(stockData.summary.stockInKg || 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    void loadMismatchAlerts();

    const timer = window.setInterval(() => {
      void loadMismatchAlerts();
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const sessionId =
        openSession && ["Open", "Paused"].includes(openSession.status)
          ? openSession._id
          : undefined;
      if (!sessionId) {
        setRecords([]);
        setStockOutKg(0);
        return;
      }
      const recordData = await getDistributionRecords({
        limit: 300,
        sessionId,
      });
      setRecords(recordData.records || []);
      setStockOutKg(recordData.stock.stockOutKg || 0);
    } catch {
      // ignore
    }
  }, [openSession]);

  useEffect(() => {
    void fetchRecords();
    if (sessionStatus === "Open" || sessionStatus === "Paused") {
      const interval = window.setInterval(() => {
        void fetchRecords();
      }, 30000);
      return () => window.clearInterval(interval);
    }
    return undefined;
  }, [sessionStatus, fetchRecords]);

  const filteredTokens = useMemo(() => {
    return tokens.filter((token) => {
      const consumer =
        typeof token.consumerId === "string" ? null : token.consumerId;
      const matchSearch =
        !search.trim() ||
        token.tokenCode.toLowerCase().includes(search.toLowerCase()) ||
        consumer?.consumerCode?.toLowerCase().includes(search.toLowerCase()) ||
        consumer?.name?.includes(search);
      const matchStatus = status === "সব" || token.status === status;
      return matchSearch && matchStatus;
    });
  }, [tokens, search, status]);

  const openCompleteModal = (token: DistributionToken) => {
    setSelectedToken(token);
    setActualKg(token.rationQtyKg);
    setPhotoVerified(false);
    setPhotoFile(null);
    setOpenComplete(true);
  };

  const onJoinQueue = async (token: DistributionToken) => {
    if (!openSession?._id) {
      setError("প্রথমে একটি সেশন চালু করুন");
      return;
    }
    const consumerId =
      typeof token.consumerId === "string"
        ? token.consumerId
        : token.consumerId._id;
    try {
      setLoading(true);
      setError("");
      const result = await joinQueue(openSession._id, consumerId);
      setQueueMsg(`কিউ নম্বর #${result.queueNumber} বরাদ্দ হয়েছে`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "কিউতে যোগ করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  const onDownloadReceipt = async (token: DistributionToken) => {
    try {
      setLoading(true);
      setError("");
      await generateReceipt(token._id);
      const blob = await downloadReceipt(token.tokenCode);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${token.tokenCode}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "রসিদ ডাউনলোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onComplete = async () => {
    if (!selectedToken) return;

    if (!photoVerified) {
      setError("ছবি যাচাই নিশ্চিত করতে চেকবক্স টিক দিন");
      return;
    }

    const consumerId =
      typeof selectedToken.consumerId === "string"
        ? selectedToken.consumerId
        : selectedToken.consumerId._id;

    try {
      setLoading(true);
      if (photoFile) {
        setPhotoBusy(true);
        await uploadConsumerPhoto(consumerId, photoFile);
        const verify = await getConsumerPhotoVerify(consumerId);
        if (!verify.hasPhoto) {
          throw new Error("ছবি যাচাই সম্পন্ন হয়নি");
        }
      }
      await completeDistribution(selectedToken.tokenCode, actualKg);
      setMessage("বিতরণ সম্পন্ন হয়েছে");
      setOpenComplete(false);
      setSelectedToken(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "বিতরণ সম্পন্ন করা যায়নি");
    } finally {
      setLoading(false);
      setPhotoBusy(false);
    }
  };

  const delta = Number((stats.expectedKg - stats.actualKg).toFixed(2));

  const onCloseSession = async () => {
    if (!openSession || openSession.status === "Planned") {
      setError("ক্লোজ করার জন্য ওপেন সেশন পাওয়া যায়নি");
      return;
    }

    const confirmed = window.confirm("আজকের সেশন ক্লোজ করতে চান?");
    if (!confirmed) return;

    try {
      setLoading(true);
      setError("");
      const result = await closeDistributionSession({
        sessionId: openSession._id,
      });
      const recon = result.reconciliation;
      setMessage(
        recon.mismatch
          ? `সেশন ক্লোজ হয়েছে, রিকনসিলিয়েশন মিসম্যাচ ${recon.mismatchKg}kg`
          : "সেশন ক্লোজ এবং রিকনসিলিয়েশন সফল",
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেশন ক্লোজ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onPlanSession = async () => {
    if (!plannedDateKey) {
      setError("সেশন তারিখ দিন");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await createDistributionSession({
        dateKey: plannedDateKey,
      });
      setMessage("সেশন পরিকল্পনা করা হয়েছে");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেশন পরিকল্পনা ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onStartSession = async () => {
    if (!openSession?._id) {
      setError("শুরু করার জন্য পরিকল্পিত সেশন নেই");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await startDistributionSession({
        sessionId: openSession._id,
      });
      setMessage("সেশন শুরু হয়েছে। এখন টোকেন স্ক্যান/ওজন ডেটা সক্রিয়");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেশন শুরু করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <PortalSection
        title="স্টক ও বিতরণ সেশন"
        right={
          <Button variant="secondary" onClick={() => void loadData()}>
            🔄 রিফ্রেশ
          </Button>
        }
      >
        {(error || message) && (
          <div
            className={`mb-3 rounded border px-3 py-2 text-[12px] ${error ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]" : "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"}`}
          >
            {error || message}
          </div>
        )}
        {queueMsg && (
          <div className="mb-3 rounded border px-3 py-2 text-[12px] bg-purple-50 border-purple-200 text-purple-700">
            {queueMsg}
          </div>
        )}

        <div className="mb-3 border rounded p-3 bg-[#f9fafb]">
          <div className="font-semibold mb-2">আজকের মজুদ নিবন্ধন</div>
          <div className="bg-orange-50 border border-orange-300 rounded-lg p-4 text-sm">
            <p className="text-orange-700 font-medium">
              🔒 Stock IN শুধুমাত্র Admin বরাদ্দ করতে পারবেন
            </p>
            <p className="text-orange-700">
              Distributor এখানে শুধু ট্র্যাক/মনিটর করতে পারবেন
            </p>
            <p className="text-orange-700 mt-1">
              মোট বরাদ্দ (derived): {todayStockTotal.toFixed(2)} কেজি
            </p>
            <p className="text-orange-700">
              এলাকা: {stockContext.division || "—"} / ওয়ার্ড{" "}
              {stockContext.ward || "—"}
            </p>
            <p className="text-orange-700">
              সেশন:{" "}
              {stockContext.sessionCode || openSession?.sessionCode || "—"}
            </p>
          </div>
        </div>

        <div className="mb-3 border rounded p-3 bg-[#f8fafc]">
          <div className="font-semibold mb-2">সেশন পরিকল্পনা ও শুরু</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <input
              type="date"
              value={plannedDateKey}
              onChange={(e) => setPlannedDateKey(e.target.value)}
              className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            />
            <Button onClick={() => void onPlanSession()} disabled={loading}>
              📅 সেশন প্ল্যান করুন
            </Button>
            <Button
              variant="secondary"
              onClick={() => void onStartSession()}
              disabled={
                loading ||
                !openSession ||
                openSession.status === "Open" ||
                openSession.status === "Closed"
              }
            >
              ▶ সেশন শুরু
            </Button>
          </div>
          <div className="text-[12px] text-[#4b5563]">
            বর্তমান অবস্থা:{" "}
            <b>
              {sessionStatus ? statusLabel(sessionStatus) : "কোনো সেশন নেই"}
            </b>
            {openSession?.scheduledStartAt
              ? ` | নির্ধারিত শুরু: ${new Date(openSession.scheduledStartAt).toLocaleString("bn-BD")}`
              : ""}
          </div>
          {sessions.length > 0 && (
            <div className="mt-2 text-[12px] text-[#374151]">
              পরিকল্পিত/চলমান সেশন:
              <div className="mt-1 flex flex-wrap gap-1">
                {sessions
                  .filter((s) =>
                    ["Planned", "Open", "Paused"].includes(s.status),
                  )
                  .map((s) => (
                    <span
                      key={s._id}
                      className="px-2 py-1 rounded border bg-white text-[11px]"
                    >
                      {s.dateKey} · {statusLabel(s.status)} ·{" "}
                      {s.sessionCode || s._id}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {mismatchAlerts.length > 0 && (
          <div className="mb-3 border border-[#fecaca] bg-[#fff1f2] rounded p-3">
            <div className="text-[12px] font-semibold text-[#991b1b] mb-2">
              ⚠️ রিয়েল-টাইম ওজন মিসম্যাচ এলার্ট
            </div>
            <div className="space-y-2">
              {mismatchAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className="flex items-start justify-between gap-3 bg-white border border-[#fdd5d8] rounded px-2 py-1.5"
                >
                  <div className="text-[12px] text-[#3f3f46]">
                    <div className="font-semibold text-[#991b1b]">
                      {alert.title}
                    </div>
                    <div>{alert.message}</div>
                    <div className="text-[11px] text-[#6b7280] mt-0.5">
                      {new Date(alert.createdAt).toLocaleString("bn-BD")}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void (async () => {
                        await markNotificationAsRead(alert._id);
                        await loadMismatchAlerts();
                      })()
                    }
                  >
                    পঠিত
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
          <div className="border rounded p-2 text-[12px]">
            মোট টোকেন: <b>{stats.totalTokens}</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            ইস্যুড: <b>{stats.issued}</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            ব্যবহৃত: <b>{stats.used}</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            মিসম্যাচ: <b>{stats.mismatches}</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            মোট Actual বিতরণ (derived): <b>{stats.actualKg.toFixed(2)} kg</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            মোট স্টক IN (derived): <b>{stockInKg.toFixed(2)} kg</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            মোট স্টক OUT (derived): <b>{stockOutKg.toFixed(2)} kg</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            ব্যালেন্স (derived): <b>{stockBalanceKg.toFixed(2)} kg</b>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          {STOCK_ITEMS.map((item) => (
            <div
              key={item}
              className="border rounded p-2 text-[12px] bg-[#fafafa]"
            >
              <div className="font-semibold">Actual বিতরণ — {item}</div>
              <div>{(statsByItem[item]?.actualKg || 0).toFixed(2)} kg</div>
              <div className="text-[#6b7280]">
                Expected: {(statsByItem[item]?.expectedKg || 0).toFixed(2)} kg
              </div>
            </div>
          ))}
        </div>
        {Object.keys(stockByItem).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {STOCK_ITEMS.map((item) => (
              <div
                key={item}
                className="border rounded p-2 text-[12px] bg-white"
              >
                <div className="font-semibold">{item}</div>
                <div>
                  IN: {(stockByItem[item]?.stockInKg ?? 0).toFixed(2)} kg
                </div>
                <div>
                  OUT: {(stockByItem[item]?.stockOutKg ?? 0).toFixed(2)} kg
                </div>
                <div>
                  ব্যালেন্স: {(stockByItem[item]?.balanceKg ?? 0).toFixed(2)} kg
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <Button
            variant="secondary"
            onClick={() => {
              if (!openSession?._id) {
                setError("লাইভ কিউ খুলতে সেশন নির্বাচন/শুরু করুন");
                return;
              }
              navigate(
                `/queue?sessionId=${encodeURIComponent(openSession._id)}`,
              );
            }}
          >
            🧾 সেশনভিত্তিক লাইভ কিউ
          </Button>
          <Button
            variant="secondary"
            onClick={() => void onCloseSession()}
            disabled={
              loading || !openSession || openSession.status === "Planned"
            }
          >
            🔒 সেশন ক্লোজ
          </Button>
        </div>

        {openSession && (
          <div className="mb-3 text-[12px] rounded border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-3 py-2">
            Session ID: {openSession.sessionCode || openSession._id} | সেশন শুরু
            হলে Stock IN lock থাকে (Admin only)
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="সার্চ: Token / Consumer / নাম"
          />
          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as "সব" | "Issued" | "Used" | "Cancelled",
              )
            }
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="সব">সব স্ট্যাটাস</option>
            <option value="Issued">ইস্যুড</option>
            <option value="Used">ব্যবহৃত</option>
            <option value="Cancelled">বাতিল</option>
          </select>
          <div className="text-[12px] border rounded px-3 py-2 bg-white">
            পার্থক্য (প্রত্যাশিত-বাস্তব):{" "}
            <b className={delta > 0 ? "text-[#b91c1c]" : ""}>{delta}</b>
          </div>
        </div>

        <div className="border border-[#cfd6e0] rounded overflow-hidden mb-4">
          <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
            লাইভ টোকেন তালিকা
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-250 text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="border border-[#cfd6e0] p-2">টোকেন</th>
                  <th className="border border-[#cfd6e0] p-2">সেশন আইডি</th>
                  <th className="border border-[#cfd6e0] p-2">উপকারভোগী</th>
                  <th className="border border-[#cfd6e0] p-2">নাম</th>
                  <th className="border border-[#cfd6e0] p-2">
                    প্রত্যাশিত (item-wise)
                  </th>
                  <th className="border border-[#cfd6e0] p-2">
                    বাস্তব (item-wise)
                  </th>
                  <th className="border border-[#cfd6e0] p-2">মিসম্যাচ কারণ</th>
                  <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                  <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map((token) => {
                  const consumer =
                    typeof token.consumerId === "string"
                      ? null
                      : token.consumerId;
                  return (
                    <tr
                      key={token._id}
                      className="odd:bg-white even:bg-[#f8fafc]"
                    >
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.tokenCode}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.sessionCode ||
                          token.session?.sessionCode ||
                          token.sessionId ||
                          "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {consumer?.consumerCode || "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2">
                        {consumer?.name || "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-left">
                        {itemQtyText(token.expectedByItem)}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-left">
                        {itemQtyText(token.actualByItem)}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-left">
                        {token.mismatchDetails?.length
                          ? token.mismatchDetails
                              .map((m) => m.reason)
                              .join("; ")
                          : "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.status === "Issued" && (
                          <Badge tone="blue">ইস্যুড</Badge>
                        )}
                        {token.status === "Used" && (
                          <Badge tone="green">ব্যবহৃত</Badge>
                        )}
                        {token.status === "Cancelled" && (
                          <Badge tone="red">বাতিল</Badge>
                        )}
                        {token.status === "Expired" && (
                          <Badge tone="yellow">মেয়াদোত্তীর্ণ</Badge>
                        )}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.status === "Issued" ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button onClick={() => openCompleteModal(token)}>
                              ⚖️ সম্পন্ন
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => void onJoinQueue(token)}
                            >
                              কিউ
                            </Button>
                          </div>
                        ) : token.status === "Used" ? (
                          <Button
                            variant="secondary"
                            onClick={() => void onDownloadReceipt(token)}
                          >
                            রসিদ
                          </Button>
                        ) : (
                          <span className="text-[#6b7280]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredTokens.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-[#6b7280]">
                      {loading
                        ? "লোড হচ্ছে..."
                        : sessionStatus === "Open" || sessionStatus === "Paused"
                          ? "কোনো টোকেন নেই"
                          : "লাইভ সেশন নেই"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-[#cfd6e0] rounded overflow-hidden">
          <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold flex items-center justify-between">
            <span>বিতরণ রেকর্ড</span>
            <button
              type="button"
              className="text-[12px] text-[#16679c] hover:underline"
              onClick={() => {
                setRefreshing(true);
                void fetchRecords().finally(() => setRefreshing(false));
              }}
            >
              {refreshing ? "লোড হচ্ছে..." : "রিফ্রেশ করুন 🔄"}
            </button>
          </div>
          {(sessionStatus === "Open" || sessionStatus === "Paused") && (
            <div className="text-[11px] px-3 py-1 bg-[#eff6ff] text-[#1e3a8a]">
              সেশন সক্রিয় — রেকর্ড প্রতি ৩০ সেকেন্ডে রিফ্রেশ হয়
            </div>
          )}
          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-250 text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="border border-[#cfd6e0] p-2">সেশন আইডি</th>
                  <th className="border border-[#cfd6e0] p-2">টোকেন কোড</th>
                  <th className="border border-[#cfd6e0] p-2">ভোক্তা কোড</th>
                  <th className="border border-[#cfd6e0] p-2">
                    প্রত্যাশিত (item-wise)
                  </th>
                  <th className="border border-[#cfd6e0] p-2">
                    প্রকৃত (item-wise)
                  </th>
                  <th className="border border-[#cfd6e0] p-2">মিসম্যাচ কারণ</th>
                  <th className="border border-[#cfd6e0] p-2">সময়</th>
                  <th className="border border-[#cfd6e0] p-2">অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {!(sessionStatus === "Open" || sessionStatus === "Paused") &&
                  records.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-4 text-center text-[#6b7280]"
                      >
                        সেশন সক্রিয় নেই
                      </td>
                    </tr>
                  )}
                {records.map((record) => {
                  const token =
                    typeof record.tokenId === "string" ? null : record.tokenId;
                  const consumer = token?.consumerId;
                  return (
                    <tr
                      key={record._id}
                      className={record.mismatch ? "bg-red-50" : "bg-green-50"}
                    >
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {record.sessionCode || record.sessionId || "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token?._id ? token.tokenCode : "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {consumer?.consumerCode || "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-left">
                        {itemQtyText(record.expectedByItem)}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-left">
                        {itemQtyText(record.actualByItem)}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-left">
                        {record.mismatchDetails?.length
                          ? record.mismatchDetails
                              .map((m) => m.reason)
                              .join("; ")
                          : "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {new Date(record.createdAt).toLocaleString()}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {record.mismatch ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">
                            অমিল ⚠️
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                            সঠিক ✓
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {records.length > 0 && (
                  <tr className="bg-gray-50 font-semibold">
                    <td
                      colSpan={4}
                      className="border border-[#cfd6e0] p-2 text-center"
                    >
                      মোট Actual বিতরণ (derived)
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {records
                        .reduce((sum, r) => sum + (Number(r.actualKg) || 0), 0)
                        .toFixed(1)}{" "}
                      কেজি
                    </td>
                    <td
                      colSpan={3}
                      className="border border-[#cfd6e0] p-2 text-center"
                    >
                      ব্যালেন্স (derived from stock ledger):{" "}
                      {stockBalanceKg.toFixed(1)} কেজি
                    </td>
                  </tr>
                )}
                {records.length === 0 && sessionStatus && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-[#6b7280]">
                      কোনো বিতরণ রেকর্ড নেই
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PortalSection>

      <Modal
        open={openComplete}
        title="বিতরণ সম্পন্ন করুন"
        onClose={() => setOpenComplete(false)}
      >
        <div className="space-y-3">
          <div className="text-[13px]">
            টোকেন: <b>{selectedToken?.tokenCode}</b>
          </div>
          <div className="text-[13px]">
            প্রত্যাশিত: <b>{itemQtyText(selectedToken?.expectedByItem)}</b>
          </div>
          <input
            type="number"
            step="1"
            value={actualKg}
            onChange={(e) => setActualKg(Number(e.target.value))}
            className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="বাস্তব কেজি (যেমন 5 kg)"
          />
          <div className="space-y-2 border rounded p-2 bg-[#faf5ff] border-[#e9d5ff]">
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={photoVerified}
                onChange={(e) => setPhotoVerified(e.target.checked)}
              />
              ছবি যাচাই হয়েছে (আবশ্যক)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[12px] bg-white"
            />
            {photoBusy && (
              <div className="text-[12px] text-[#6b21a8]">
                ছবি যাচাই হচ্ছে...
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenComplete(false)}>
              বাতিল
            </Button>
            <Button onClick={() => void onComplete()} disabled={loading}>
              সেভ করুন
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
