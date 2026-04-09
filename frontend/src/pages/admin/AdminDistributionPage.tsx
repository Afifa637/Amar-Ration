import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  closeDistributionSession,
  getAdminDistributors,
  getAdminDistributionMonitoring,
  getAdminSummary,
  getDistributionSessions,
  getStockSummary,
  recordStockIn,
  type AdminDistributorRow,
  type AdminDistributionMonitorRow,
  type AdminSummary,
} from "../../services/api";

export default function AdminDistributionPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [rows, setRows] = useState<AdminDistributionMonitorRow[]>([]);
  const [distributors, setDistributors] = useState<AdminDistributorRow[]>([]);
  const [sessions, setSessions] = useState<
    Array<{
      _id: string;
      distributorId: string;
      dateKey: string;
      status: "Open" | "Paused" | "Closed";
      openedAt?: string;
      closedAt?: string;
      createdAt: string;
      updatedAt: string;
    }>
  >([]);
  const [criticalEvents, setCriticalEvents] = useState<
    Array<{
      _id: string;
      action: string;
      severity: "Info" | "Warning" | "Critical";
      createdAt: string;
    }>
  >([]);
  const [selectedDistributorId, setSelectedDistributorId] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [stockRef, setStockRef] = useState("");
  const [stockBalance, setStockBalance] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMainData = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, monitoringData, distributorsData, sessionData] =
        await Promise.all([
          getAdminSummary(),
          getAdminDistributionMonitoring(),
          getAdminDistributors(),
          getDistributionSessions({ page: 1, limit: 200 }),
        ]);
      setSummary(summaryData);
      setCriticalEvents(
        (summaryData.alerts || []).filter((a) =>
          ["Critical", "Warning"].includes(a.severity),
        ),
      );
      setRows(monitoringData.rows || []);
      const activeRows = (distributorsData.rows || []).filter(
        (row) => row.authorityStatus === "Active",
      );
      setDistributors(activeRows);
      setSessions(sessionData.sessions || []);
      if (!selectedDistributorId && activeRows[0]?.distributorId) {
        setSelectedDistributorId(activeRows[0].distributorId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ডিস্ট্রিবিউশন ডেটা লোড ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCriticalFeed = async () => {
    try {
      const summaryData = await getAdminSummary();
      setCriticalEvents(
        (summaryData.alerts || []).filter((a) =>
          ["Critical", "Warning"].includes(a.severity),
        ),
      );
    } catch {
      // keep existing feed data
    }
  };

  useEffect(() => {
    void loadMainData();

    const summaryTimer = window.setInterval(() => {
      void loadMainData();
    }, 60000);

    const criticalTimer = window.setInterval(() => {
      void loadCriticalFeed();
    }, 30000);

    return () => {
      window.clearInterval(summaryTimer);
      window.clearInterval(criticalTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDistributorId) return;
    const loadStock = async () => {
      try {
        const data = await getStockSummary({
          distributorId: selectedDistributorId,
        });
        setStockBalance(data.summary.balanceKg);
      } catch {
        setStockBalance(null);
      }
    };
    void loadStock();
  }, [selectedDistributorId]);

  const pausedPoints = useMemo(
    () => rows.filter((row) => row.status === "Mismatch").length,
    [rows],
  );

  const statusLabel = (status: AdminDistributionMonitorRow["status"]) =>
    status === "Mismatch" ? "মিসম্যাচ" : "ম্যাচড";

  const onAllocateStock = async () => {
    const qty = Number(stockQty);
    if (!selectedDistributorId) {
      setError("ডিস্ট্রিবিউটর নির্বাচন করুন");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("স্টক কেজি সঠিকভাবে দিন");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await recordStockIn({
        distributorId: selectedDistributorId,
        qtyKg: qty,
        ref: stockRef || undefined,
      });
      const stock = await getStockSummary({
        distributorId: selectedDistributorId,
      });
      setStockBalance(stock.summary.balanceKg);
      setStockQty("");
      setStockRef("");
      setMessage("স্টক IN বরাদ্দ সংরক্ষণ হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "স্টক IN বরাদ্দ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onCloseSession = async () => {
    if (!selectedDistributorId) {
      setError("ডিস্ট্রিবিউটর নির্বাচন করুন");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const sessionData = await getDistributionSessions({
        distributorId: selectedDistributorId,
        status: "Open",
        limit: 1,
      });

      const target = sessionData.sessions?.[0];
      if (!target) {
        setError("এই ডিস্ট্রিবিউটরের কোনো ওপেন সেশন নেই");
        return;
      }

      const result = await closeDistributionSession({
        sessionId: target._id,
        distributorId: selectedDistributorId,
        note: "Admin manual close",
      });

      const recon = result.reconciliation;
      setMessage(
        recon.mismatch
          ? `সেশন ক্লোজ: মিসম্যাচ ${recon.mismatchKg}kg`
          : "সেশন ক্লোজ সফল",
      );
      await loadMainData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেশন ক্লোজ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const relativeBanglaTime = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return "এইমাত্র";
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return "এইমাত্র";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} মিনিট আগে`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ঘন্টা আগে`;
    const day = Math.floor(hr / 24);
    return `${day} দিন আগে`;
  };

  const distributorById = useMemo(() => {
    const map = new Map<string, AdminDistributorRow>();
    distributors.forEach((d) => {
      if (d.distributorId) map.set(d.distributorId, d);
    });
    return map;
  }, [distributors]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> টোকেন ও ডিস্ট্রিবিউশন কন্ট্রোল
      </div>

      <SectionCard title="বিতরণ দিনের নিয়ন্ত্রণ">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => void loadMainData()}
            className="px-3 py-1.5 rounded border border-[#cfd6e0] text-[12px] hover:bg-[#f8fafc]"
          >
            🔄 রিফ্রেশ
          </button>
        </div>
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-3 text-[12px] bg-[#ecfdf3] border border-[#86efac] text-[#166534] px-3 py-2 rounded">
            {message}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["ভ্যালিড স্ক্যান", String(summary?.ops.validScans ?? 0)],
            ["রিজেক্টেড স্ক্যান", String(summary?.ops.rejectedScans ?? 0)],
            ["ইস্যুকৃত টোকেন", String(summary?.ops.tokensGenerated ?? 0)],
            ["স্থগিত পয়েন্ট", String(pausedPoints)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]"
            >
              <div className="text-sm text-[#6b7280]">{label}</div>
              <div className="text-2xl font-bold text-[#1f2d3d] mt-1">
                {value}
              </div>
            </div>
          ))}
        </div>
        {loading && (
          <div className="text-[12px] text-[#6b7280] mt-2">লোড হচ্ছে...</div>
        )}
      </SectionCard>

      <SectionCard title="রিয়েল-টাইম ভ্যালিডেশন লজিক">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• QR ভ্যালিডিটি যাচাই</li>
          <li>• উপকারভোগীর সক্রিয়/নিষ্ক্রিয় স্ট্যাটাস যাচাই</li>
          <li>• ডুপ্লিকেট ফ্যামিলি কনফ্লিক্ট যাচাই</li>
          <li>• শুধুমাত্র বৈধ উপকারভোগীর জন্য টোকেন ইস্যু</li>
          <li>• ব্যবহৃত টোকেন পুনর্ব্যবহারযোগ্য নয়</li>
        </ul>
      </SectionCard>

      <SectionCard title="স্টক বরাদ্দ ও সেশন নিয়ন্ত্রণ">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
          <select
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
            value={selectedDistributorId}
            onChange={(e) => setSelectedDistributorId(e.target.value)}
          >
            <option value="">ডিস্ট্রিবিউটর নির্বাচন করুন</option>
            {distributors
              .filter((row) => !!row.distributorId)
              .map((row) => (
                <option key={row.userId} value={row.distributorId || ""}>
                  {row.name} ({row.ward || "N/A"})
                </option>
              ))}
          </select>

          <input
            type="number"
            step="0.01"
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="স্টক IN (kg)"
          />

          <input
            value={stockRef}
            onChange={(e) => setStockRef(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="ব্যাচ/রেফারেন্স"
          />

          <button
            onClick={() => void onAllocateStock()}
            className="px-3 py-2 rounded bg-[#16679c] text-white text-[13px] hover:bg-[#0f557f]"
            disabled={loading}
          >
            স্টক IN সেভ
          </button>

          <button
            onClick={() => void onCloseSession()}
            className="px-3 py-2 rounded bg-[#7c3aed] text-white text-[13px] hover:bg-[#6d28d9]"
            disabled={loading}
          >
            ম্যানুয়াল সেশন ক্লোজ
          </button>
        </div>

        <div className="mt-2 text-[12px] text-[#4b5563]">
          নির্বাচিত ডিস্ট্রিবিউটরের বর্তমান স্টক ব্যালেন্স:{" "}
          <span className="font-semibold">{stockBalance ?? "—"} kg</span>
        </div>
      </SectionCard>

      <SectionCard title="আইওটি ওজন ও স্টক মনিটরিং">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "ডিস্ট্রিবিউটর",
                  "বিভাগ / ওয়ার্ড",
                  "প্রত্যাশিত ওজন",
                  "প্রকৃত ওজন",
                  "স্ট্যাটাস",
                  "অ্যাকশন",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={`${row.ward}-${idx}`}
                  className="odd:bg-white even:bg-[#fafbfc]"
                >
                  <td className="p-2 border border-[#d7dde6]">
                    {row.distributor || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    <div>{row.division || "—"}</div>
                    <div className="text-[11px] text-[#6b7280]">
                      Ward {row.ward || "—"}
                    </div>
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.expectedKg}kg
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.actualKg}kg
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {statusLabel(row.status)}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.status === "Mismatch" ? "স্থগিত + এলার্ট" : "চলমান"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="প্রতি-ডিস্ট্রিবিউটর লাইভ সেশন">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "ডিস্ট্রিবিউটর",
                  "ওয়ার্ড",
                  "তারিখ",
                  "স্ট্যাটাস",
                  "শুরু",
                  "শেষ আপডেট",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const d = distributorById.get(s.distributorId);
                return (
                  <tr key={s._id} className="odd:bg-white even:bg-[#fafbfc]">
                    <td className="p-2 border border-[#d7dde6]">
                      {d?.name || "—"}
                    </td>
                    <td className="p-2 border border-[#d7dde6]">
                      {d?.ward || "—"}
                    </td>
                    <td className="p-2 border border-[#d7dde6]">{s.dateKey}</td>
                    <td className="p-2 border border-[#d7dde6]">
                      {s.status === "Open"
                        ? "Open"
                        : s.status === "Paused"
                          ? "Paused"
                          : "Closed"}
                    </td>
                    <td className="p-2 border border-[#d7dde6]">
                      {s.openedAt
                        ? new Date(s.openedAt).toLocaleString("bn-BD")
                        : "—"}
                    </td>
                    <td className="p-2 border border-[#d7dde6]">
                      {relativeBanglaTime(s.updatedAt)}
                    </td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-[#6b7280]">
                    কোনো সেশন ডেটা নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="ক্রিটিকাল ইভেন্ট ফিড (৩০ সেকেন্ডে আপডেট)">
        <div className="space-y-2">
          {criticalEvents.slice(0, 10).map((event) => (
            <div
              key={event._id}
              className={`border rounded px-3 py-2 text-[13px] ${
                event.severity === "Critical"
                  ? "bg-[#fef2f2] border-[#fecaca]"
                  : "bg-[#fff7ed] border-[#fed7aa]"
              }`}
            >
              <div className="font-medium">{event.action}</div>
              <div className="text-[12px] text-[#6b7280]">
                {event.severity} • {relativeBanglaTime(event.createdAt)}
              </div>
            </div>
          ))}
          {criticalEvents.length === 0 && (
            <div className="text-[12px] text-[#6b7280]">
              কোনো ক্রিটিকাল ইভেন্ট নেই
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
