import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  applyAdminAlertAction,
  closeDistributionSession,
  getAdminDistributors,
  getAdminDistributionMonitoring,
  getAdminSummary,
  getDistributionSessions,
  getStockSummary,
  recordStockIn,
  type AdminDistributorRow,
  type AdminMonitoringDistributorGroup,
  type AdminMonitoringSessionGroup,
  type AdminSummary,
  type StockItem,
} from "../../services/api";

type MonitoringTab = "live" | "recent" | "planned" | "mismatch";
const STOCK_ITEMS: StockItem[] = ["চাল", "ডাল", "পেঁয়াজ"];
const SESSION_STATUS_OPTIONS = ["", "Open", "Paused", "Closed", "Planned"];

export default function AdminDistributionPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [groups, setGroups] = useState<AdminMonitoringDistributorGroup[]>([]);
  const [distributors, setDistributors] = useState<AdminDistributorRow[]>([]);
  const [criticalEvents, setCriticalEvents] = useState<
    Array<{
      _id: string;
      action: string;
      severity: "Info" | "Warning" | "Critical";
      createdAt: string;
      meta?: {
        division?: string;
        ward?: string;
        distributorName?: string;
        distributorId?: string;
        sessionId?: string;
        sourceAction?: string;
        actionable?: boolean;
      };
    }>
  >([]);

  const [tab, setTab] = useState<MonitoringTab>("live");
  const [monitorDistributorId, setMonitorDistributorId] = useState("");
  const [monitorDivision, setMonitorDivision] = useState("");
  const [monitorWard, setMonitorWard] = useState("");
  const [monitorSessionStatus, setMonitorSessionStatus] = useState("");
  const [monitorItem, setMonitorItem] = useState<StockItem | "">("");
  const [monitorMismatchOnly, setMonitorMismatchOnly] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPages, setHistoryPages] = useState(1);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const [selectedDistributorId, setSelectedDistributorId] = useState("");
  const [stockDivision, setStockDivision] = useState("");
  const [stockWard, setStockWard] = useState("");
  const [stockAllocations, setStockAllocations] = useState<
    Record<StockItem, string>
  >({
    চাল: "",
    ডাল: "",
    পেঁয়াজ: "",
  });
  const [stockRef, setStockRef] = useState("");
  const [stockBalanceTotal, setStockBalanceTotal] = useState<number | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filterParams = useMemo(
    () => ({
      view: tab,
      distributorId: monitorDistributorId || undefined,
      division: monitorDivision || undefined,
      ward: monitorWard || undefined,
      sessionStatus: monitorSessionStatus || undefined,
      item: monitorItem || undefined,
      mismatchOnly: tab === "mismatch" ? true : monitorMismatchOnly,
      page: tab === "recent" || tab === "planned" ? historyPage : 1,
      limit: tab === "recent" || tab === "planned" ? 8 : 40,
    }),
    [
      historyPage,
      monitorDistributorId,
      monitorDivision,
      monitorItem,
      monitorMismatchOnly,
      monitorSessionStatus,
      monitorWard,
      tab,
    ],
  );

  const loadMainData = async () => {
    setLoading(true);
    setError("");
    try {
      if (monitorWard.trim() && !monitorDivision.trim()) {
        setError("ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ দিন");
        setGroups([]);
        setHistoryPages(1);
        return;
      }

      const [summaryData, monitoringData, distributorsData] = await Promise.all(
        [
          getAdminSummary(),
          getAdminDistributionMonitoring(filterParams),
          getAdminDistributors(),
        ],
      );
      setSummary(summaryData);
      setCriticalEvents(
        (summaryData.alerts || []).filter(
          (a) =>
            ["Critical", "Warning"].includes(a.severity) &&
            a.action !== "ADMIN_ALERT_ACTION_APPLIED",
        ),
      );
      setGroups(monitoringData.groups || []);
      setHistoryPages(monitoringData.pagination?.pages || 1);
      const activeRows = (distributorsData.rows || []).filter(
        (row) => row.authorityStatus === "Active",
      );
      setDistributors(activeRows);
      if (!selectedDistributorId && activeRows[0]?.distributorId) {
        setSelectedDistributorId(activeRows[0].distributorId);
      }

      if (!stockDivision && activeRows[0]?.division) {
        setStockDivision(activeRows[0].division);
      }

      const nextExpanded: Record<string, boolean> = {};
      (monitoringData.groups || []).forEach((g) => {
        nextExpanded[g.distributorId] = expandedMap[g.distributorId] ?? true;
      });
      setExpandedMap(nextExpanded);
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
        (summaryData.alerts || []).filter(
          (a) =>
            ["Critical", "Warning"].includes(a.severity) &&
            a.action !== "ADMIN_ALERT_ACTION_APPLIED",
        ),
      );
    } catch {
      // keep existing feed data
    }
  };

  useEffect(() => {
    void loadMainData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParams]);

  useEffect(() => {
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
        setStockBalanceTotal(data.summary.balanceKg);
      } catch {
        setStockBalanceTotal(null);
      }
    };
    void loadStock();
  }, [selectedDistributorId]);

  const pausedPoints = useMemo(
    () => groups.reduce((sum, g) => sum + (g.totals.mismatchCount || 0), 0),
    [groups],
  );

  const totalOpenSessions = useMemo(
    () =>
      groups.reduce(
        (sum, g) =>
          sum +
          g.sessions.filter((s) => ["Open", "Paused"].includes(s.sessionStatus))
            .length,
        0,
      ),
    [groups],
  );

  const stockDivisionOptions = useMemo(
    () =>
      Array.from(
        new Set(distributors.map((d) => d.division || "").filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [distributors],
  );

  const stockWardOptions = useMemo(
    () =>
      Array.from(
        new Set(
          distributors
            .filter((d) =>
              stockDivision ? (d.division || "") === stockDivision : true,
            )
            .map((d) => d.ward || d.wardNo || "")
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [distributors, stockDivision],
  );

  const scopedDistributor = useMemo(
    () =>
      distributors.find(
        (d) =>
          (d.division || "") === stockDivision &&
          (d.ward || d.wardNo || "") === stockWard,
      ) || null,
    [distributors, stockDivision, stockWard],
  );

  const scopedGroup = useMemo(
    () =>
      groups.find(
        (g) =>
          g.distributorId === (scopedDistributor?.distributorId || "") ||
          (g.division === stockDivision && g.ward === stockWard),
      ) || null,
    [groups, scopedDistributor, stockDivision, stockWard],
  );

  const latestScopedSession = useMemo(() => {
    if (!scopedGroup?.sessions?.length) return null;
    return [...scopedGroup.sessions].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
  }, [scopedGroup]);

  useEffect(() => {
    const nextId = scopedDistributor?.distributorId || "";
    if (nextId && nextId !== selectedDistributorId) {
      setSelectedDistributorId(nextId);
    }
  }, [scopedDistributor, selectedDistributorId]);

  const onAllocateStock = async () => {
    if (!stockDivision || !stockWard) {
      setError("স্টক বরাদ্দের জন্য বিভাগ + ওয়ার্ড নির্বাচন করুন");
      return;
    }

    const payloadRows = STOCK_ITEMS.map((item) => ({
      item,
      qty: Number(stockAllocations[item] || 0),
    })).filter((row) => Number.isFinite(row.qty) && row.qty > 0);

    if (payloadRows.length === 0) {
      setError("কমপক্ষে একটি আইটেমে বরাদ্দ দিন");
      return;
    }

    if (payloadRows.some((row) => !Number.isInteger(row.qty) || row.qty < 1)) {
      setError("প্রতি আইটেমের বরাদ্দ ১ কেজি ধাপে পূর্ণসংখ্যা হতে হবে");
      return;
    }

    try {
      setLoading(true);
      setError("");

      let resolvedDistributorId = scopedDistributor?.distributorId || "";

      for (const row of payloadRows) {
        const result = await recordStockIn({
          distributorId: resolvedDistributorId || undefined,
          division: stockDivision,
          ward: stockWard,
          qtyKg: row.qty,
          item: row.item,
          ref: stockRef || undefined,
        });

        if (!resolvedDistributorId) {
          resolvedDistributorId =
            typeof result.entry.distributorId === "string"
              ? result.entry.distributorId
              : "";
        }
      }

      if (!resolvedDistributorId) {
        setError("স্টক বরাদ্দ হয়েছে, তবে distributor সনাক্ত করা যায়নি");
        await loadMainData();
        return;
      }

      if (!selectedDistributorId) {
        setSelectedDistributorId(resolvedDistributorId);
      }

      const stock = await getStockSummary({
        distributorId: resolvedDistributorId,
      });
      setStockBalanceTotal(stock.summary.balanceKg);
      setStockAllocations({ চাল: "", ডাল: "", পেঁয়াজ: "" });
      setStockRef("");
      setMessage("স্টক IN বরাদ্দ সংরক্ষণ হয়েছে");
      await loadMainData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "স্টক IN বরাদ্দ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onCloseSession = async () => {
    const targetDistributorId =
      selectedDistributorId || scopedDistributor?.distributorId || "";

    if (!targetDistributorId) {
      setError(
        "সেশন ক্লোজের জন্য বিভাগ+ওয়ার্ড বা ডিস্ট্রিবিউটর নির্বাচন করুন",
      );
      return;
    }

    try {
      setLoading(true);
      setError("");
      const sessionData = await getDistributionSessions({
        distributorId: targetDistributorId,
        status: "Open",
        limit: 1,
      });

      const target =
        sessionData.sessions?.[0] ||
        (
          await getDistributionSessions({
            distributorId: targetDistributorId,
            status: "Paused",
            limit: 1,
          })
        ).sessions?.[0];
      if (!target) {
        setError("এই ডিস্ট্রিবিউটরের কোনো ওপেন সেশন নেই");
        return;
      }

      const result = await closeDistributionSession({
        sessionId: target._id,
        distributorId: targetDistributorId,
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

  const onAlertAction = async (
    alertId: string,
    action:
      | "acknowledge"
      | "under_review"
      | "pause_session"
      | "stop_session"
      | "request_audit",
  ) => {
    try {
      setLoading(true);
      setError("");
      await applyAdminAlertAction(alertId, { action });
      setMessage("এলার্ট অ্যাকশন প্রয়োগ হয়েছে");
      await loadMainData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "এলার্ট অ্যাকশন ব্যর্থ");
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

  const divisionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          distributors
            .map((d) => d.division || "")
            .filter((v): v is string => Boolean(v)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [distributors],
  );

  const wardOptions = useMemo(
    () =>
      Array.from(
        new Set(
          distributors
            .filter((d) =>
              monitorDivision ? (d.division || "") === monitorDivision : true,
            )
            .map((d) => d.ward || d.wardNo || "")
            .filter((v): v is string => Boolean(v)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [distributors, monitorDivision],
  );

  const toggleGroup = (distributorId: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [distributorId]: !prev[distributorId],
    }));
  };

  const statusBadgeClass = (status: string) => {
    if (status === "Open") return "bg-emerald-100 text-emerald-800";
    if (status === "Paused") return "bg-amber-100 text-amber-800";
    if (status === "Closed") return "bg-slate-100 text-slate-800";
    return "bg-sky-100 text-sky-800";
  };

  const renderSession = (s: AdminMonitoringSessionGroup) => {
    const mismatchRows = s.rows.filter((r) => r.mismatch);
    const mismatchByItem = STOCK_ITEMS.map((item) => ({
      item,
      mismatchKg: s.itemBreakdown?.[item]?.mismatchKg ?? 0,
      expectedKg: s.itemBreakdown?.[item]?.scanExpectedKg ?? 0,
      actualKg: s.itemBreakdown?.[item]?.actualKg ?? 0,
    })).filter((row) => row.mismatchKg > 0);

    return (
      <div
        key={s.sessionId}
        className="border border-[#d7dde6] rounded-lg p-3 bg-white space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] px-2 py-1 rounded bg-[#f1f5f9] text-[#334155]">
              সেশন: {s.dateKey}
            </span>
            <span
              className={`text-[12px] px-2 py-1 rounded ${statusBadgeClass(s.sessionStatus)}`}
            >
              {s.sessionStatus}
            </span>
          </div>
          <div className="text-[12px] text-[#6b7280]">
            শেষ আপডেট: {relativeBanglaTime(s.updatedAt)}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[13px]">
          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">বরাদ্দ/পারমিটেড</div>
            <div className="font-semibold">{s.assignedUsers ?? 0}</div>
          </div>
          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">স্ক্যানড</div>
            <div className="font-semibold">{s.scannedUsers ?? 0}</div>
          </div>
          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">ম্যাচড/মিসম্যাচ</div>
            <div className="font-semibold">
              {s.matchedUsers ?? 0} / {s.mismatchUsers ?? s.mismatchCount}
            </div>
          </div>
          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">Pending / No-show</div>
            <div className="font-semibold">
              {s.pendingUsers ?? 0} / {s.noShowUsers ?? 0}
            </div>
          </div>
          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">ক্রিটিকাল এলার্ট</div>
            <div className="font-semibold">{s.criticalAlertsCount ?? 0}</div>
          </div>

          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">প্রত্যাশিত</div>
            <div className="font-semibold">{s.expectedKg} kg</div>
          </div>
          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">প্রকৃত</div>
            <div className="font-semibold">{s.actualKg} kg</div>
          </div>
          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">শর্টফল</div>
            <div className="font-semibold">{s.shortfallKg ?? 0} kg</div>
          </div>
          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">মোট মিসম্যাচ</div>
            <div className="font-semibold">
              {s.mismatchKg ?? 0} kg ({s.mismatchCount})
            </div>
          </div>
          <div className="border border-[#e5e7eb] rounded p-2 bg-[#fafafa]">
            <div className="text-[#6b7280]">সেশন বরাদ্দ (kg)</div>
            <div className="font-semibold">{s.plannedKg ?? 0} kg</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {STOCK_ITEMS.map((item) => (
            <div
              key={`${s.sessionId}-${item}`}
              className={`rounded border px-2 py-1.5 text-[12px] ${
                monitorItem === item
                  ? "border-[#0f766e] bg-[#ecfeff]"
                  : "border-[#e5e7eb] bg-[#f8fafc]"
              }`}
            >
              <div className="text-[#6b7280] font-semibold mb-1">{item}</div>
              <div className="grid grid-cols-2 gap-1">
                <div>বরাদ্দ: {s.itemBreakdown?.[item]?.plannedKg ?? 0}kg</div>
                <div>
                  স্ক্যান-প্রত্যাশিত:{" "}
                  {s.itemBreakdown?.[item]?.scanExpectedKg ?? 0}
                  kg
                </div>
                <div>প্রকৃত: {s.itemBreakdown?.[item]?.actualKg ?? 0}kg</div>
                <div>
                  মিসম্যাচ: {s.itemBreakdown?.[item]?.mismatchKg ?? 0}kg
                </div>
                <div className="col-span-2 font-semibold">
                  অবশিষ্ট: {s.itemBreakdown?.[item]?.remainingKg ?? 0}kg
                </div>
              </div>
            </div>
          ))}
        </div>

        {mismatchRows.length > 0 && (
          <div className="border border-[#fecaca] bg-[#fef2f2] rounded p-2">
            <div className="text-[12px] font-semibold text-[#991b1b] mb-1">
              আইটেমভিত্তিক মিসম্যাচ
            </div>
            <div className="space-y-1 mb-2">
              {mismatchByItem.map((row) => (
                <div
                  key={`${s.sessionId}-${row.item}`}
                  className="grid grid-cols-4 gap-2 text-[12px] border border-[#fca5a5] rounded px-2 py-1 bg-white"
                >
                  <span>আইটেম: {row.item}</span>
                  <span>স্ক্যান-প্রত্যাশিত: {row.expectedKg}kg</span>
                  <span>প্রকৃত: {row.actualKg}kg</span>
                  <span className="text-[#b91c1c]">
                    মিসম্যাচ: {row.mismatchKg}kg
                  </span>
                </div>
              ))}
            </div>
            <div className="text-[12px] font-semibold text-[#991b1b] mb-1">
              মিসম্যাচ সারি (রেকর্ড)
            </div>
            <div className="space-y-1">
              {mismatchRows.slice(0, 8).map((row) => (
                <div
                  key={row.recordId}
                  className="grid grid-cols-4 gap-2 text-[12px] border border-[#fca5a5] rounded px-2 py-1 bg-white"
                >
                  <span>আইটেম: {row.item}</span>
                  <span>প্রত্যাশিত: {row.expectedKg}kg</span>
                  <span>প্রকৃত: {row.actualKg}kg</span>
                  <span className="text-[#b91c1c]">মিসম্যাচ</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> সংগ্রহ ও স্টক কন্ট্রোল
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
            ["লাইভ/এক্টিভ সেশন", String(totalOpenSessions)],
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

      <SectionCard title="স্টক বরাদ্দ ও সেশন নিয়ন্ত্রণ">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
          <select
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
            value={stockDivision}
            onChange={(e) => {
              setStockDivision(e.target.value);
              setStockWard("");
            }}
          >
            <option value="">বিভাগ নির্বাচন করুন</option>
            {stockDivisionOptions.map((division) => (
              <option key={division} value={division}>
                {division}
              </option>
            ))}
          </select>

          <select
            value={stockWard}
            onChange={(e) => setStockWard(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">ওয়ার্ড নির্বাচন করুন</option>
            {stockWardOptions.map((ward) => (
              <option key={ward} value={ward}>
                {ward}
              </option>
            ))}
          </select>

          <input
            value={stockRef}
            onChange={(e) => setStockRef(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="ব্যাচ/রেফারেন্স"
          />

          <div className="text-[12px] text-[#4b5563] border border-[#d7dde6] rounded px-3 py-2 bg-[#f8fafc]">
            অ্যাসাইনড ডিস্ট্রিবিউটর: <b>{scopedDistributor?.name || "—"}</b>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {(
            [
              ["🌾", "চাল"],
              ["🫘", "ডাল"],
              ["🧅", "পেঁয়াজ"],
            ] as Array<[string, StockItem]>
          ).map(([icon, item]) => (
            <div
              key={item}
              className="rounded-xl border border-[#d7dde6] bg-linear-to-br from-white to-[#f8fbff] p-4"
            >
              <div className="text-lg font-semibold mb-2">
                {icon} {item}
              </div>
              <input
                type="number"
                min={0}
                step={1}
                value={stockAllocations[item]}
                onChange={(e) =>
                  setStockAllocations((prev) => ({
                    ...prev,
                    [item]: e.target.value,
                  }))
                }
                className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[14px]"
                placeholder={`${item} স্টক IN (kg)`}
              />
              <div className="mt-2 text-[12px] text-[#6b7280]">
                ১ কেজি ধাপে বরাদ্দ দিন
              </div>
              <div className="mt-2 text-[12px] text-[#334155]">
                অবশিষ্ট:{" "}
                {latestScopedSession?.itemBreakdown?.[item]?.remainingKg ?? "—"}
                kg
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
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

        <div className="mt-2 text-[12px] text-[#4b5563] space-y-1">
          <div>
            মোট (সব আইটেম) ব্যালেন্স:{" "}
            <span className="font-semibold">{stockBalanceTotal ?? "—"} kg</span>
          </div>
          {latestScopedSession && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
              <span>সেশন স্ট্যাটাস: {latestScopedSession.sessionStatus}</span>
              <span>
                শেষ আপডেট: {relativeBanglaTime(latestScopedSession.updatedAt)}
              </span>
              <span>
                স্ক্যান-প্রত্যাশিত: {latestScopedSession.expectedKg}kg
              </span>
              <span>প্রকৃত বিতরণ: {latestScopedSession.actualKg}kg</span>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="আইওটি ওজন + স্টক মনিটরিং (ডিস্ট্রিবিউটর-গ্রুপড)">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["live", "Live"],
              ["recent", "Recent"],
              ["planned", "Planned"],
              ["mismatch", "Mismatch Only"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key as MonitoringTab);
                  setHistoryPage(1);
                }}
                className={`px-3 py-1.5 rounded text-[12px] border ${
                  tab === key
                    ? "bg-[#16679c] border-[#16679c] text-white"
                    : "bg-white border-[#cfd6e0] text-[#334155]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <select
              value={monitorDistributorId}
              onChange={(e) => {
                setMonitorDistributorId(e.target.value);
                setHistoryPage(1);
              }}
              className="border border-[#cfd6e0] rounded px-2 py-2 text-[12px] bg-white"
            >
              <option value="">সব ডিস্ট্রিবিউটর</option>
              {distributors
                .filter((d) => d.distributorId)
                .map((d) => (
                  <option key={d.userId} value={d.distributorId || ""}>
                    {d.name}
                  </option>
                ))}
            </select>

            <select
              value={monitorDivision}
              onChange={(e) => {
                setMonitorDivision(e.target.value);
                setMonitorWard("");
                setHistoryPage(1);
              }}
              className="border border-[#cfd6e0] rounded px-2 py-2 text-[12px] bg-white"
            >
              <option value="">সব বিভাগ</option>
              {divisionOptions.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>

            <select
              value={monitorWard}
              onChange={(e) => {
                setMonitorWard(e.target.value);
                setHistoryPage(1);
              }}
              className="border border-[#cfd6e0] rounded px-2 py-2 text-[12px] bg-white"
            >
              <option value="">সব ওয়ার্ড</option>
              {wardOptions.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>

            <select
              value={monitorSessionStatus}
              onChange={(e) => {
                setMonitorSessionStatus(e.target.value);
                setHistoryPage(1);
              }}
              className="border border-[#cfd6e0] rounded px-2 py-2 text-[12px] bg-white"
            >
              <option value="">সব স্ট্যাটাস</option>
              {SESSION_STATUS_OPTIONS.filter(Boolean).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={monitorItem}
              onChange={(e) => {
                setMonitorItem((e.target.value as StockItem) || "");
                setHistoryPage(1);
              }}
              className="border border-[#cfd6e0] rounded px-2 py-2 text-[12px] bg-white"
            >
              <option value="">সব আইটেম</option>
              {STOCK_ITEMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-2 border border-[#cfd6e0] rounded px-2 py-2 text-[12px] bg-white">
              <input
                type="checkbox"
                checked={monitorMismatchOnly || tab === "mismatch"}
                onChange={(e) => {
                  if (tab === "mismatch") return;
                  setMonitorMismatchOnly(e.target.checked);
                  setHistoryPage(1);
                }}
                disabled={tab === "mismatch"}
              />
              শুধু মিসম্যাচ
            </label>
          </div>

          {groups.length === 0 && (
            <div className="border border-dashed border-[#d7dde6] rounded p-5 text-center text-[13px] text-[#6b7280]">
              নির্বাচিত ফিল্টারে কোনো ডেটা নেই
            </div>
          )}

          <div className="space-y-3">
            {groups.map((group) => {
              const expanded = expandedMap[group.distributorId] ?? true;
              return (
                <div
                  key={group.distributorId}
                  className="border border-[#d7dde6] rounded-lg bg-[#f8fafc]"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.distributorId)}
                    className="w-full text-left px-3 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-[#0f172a]">
                        {group.distributorName}
                      </div>
                      <div className="text-[12px] text-[#64748b]">
                        {group.division} • ওয়ার্ড {group.ward}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[12px]">
                      <span className="px-2 py-1 rounded bg-white border border-[#cbd5e1]">
                        প্রত্যাশিত: {group.totals.expectedKg}kg
                      </span>
                      <span className="px-2 py-1 rounded bg-white border border-[#cbd5e1]">
                        প্রকৃত: {group.totals.actualKg}kg
                      </span>
                      <span className="px-2 py-1 rounded bg-[#fee2e2] text-[#b91c1c] border border-[#fecaca]">
                        মিসম্যাচ: {group.totals.mismatchCount}
                      </span>
                      <span className="px-2 py-1 rounded bg-white border border-[#cbd5e1]">
                        {expanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 space-y-3">
                      {group.sessions.map((s) => renderSession(s))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {(tab === "recent" || tab === "planned") && historyPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                className="px-3 py-1.5 rounded border border-[#cfd6e0] text-[12px] disabled:opacity-50"
              >
                পূর্ববর্তী
              </button>
              <span className="text-[12px] text-[#6b7280]">
                পৃষ্ঠা {historyPage} / {historyPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setHistoryPage((p) => Math.min(historyPages, p + 1))
                }
                disabled={historyPage >= historyPages}
                className="px-3 py-1.5 rounded border border-[#cfd6e0] text-[12px] disabled:opacity-50"
              >
                পরবর্তী
              </button>
            </div>
          )}
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
              <div className="font-medium">
                {event.meta?.sourceAction
                  ? `${event.action} (${event.meta.sourceAction})`
                  : event.action}
              </div>
              <div className="text-[12px] text-[#6b7280]">
                {event.severity} • {relativeBanglaTime(event.createdAt)}
              </div>
              <div className="text-[12px] text-[#334155] mt-1">
                {event.meta?.division || "—"} • ওয়ার্ড{" "}
                {event.meta?.ward || "—"}
                {event.meta?.distributorName
                  ? ` • ${event.meta.distributorName}`
                  : ""}
                {event.meta?.sessionId
                  ? ` • Session ${event.meta.sessionId}`
                  : ""}
              </div>
              {(event.meta?.actionable ?? true) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="px-2 py-1 text-[11px] rounded border border-[#cbd5e1] bg-white"
                    onClick={() => void onAlertAction(event._id, "acknowledge")}
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-[11px] rounded border border-[#cbd5e1] bg-white"
                    onClick={() =>
                      void onAlertAction(event._id, "under_review")
                    }
                  >
                    Under review
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-[11px] rounded border border-[#f59e0b] bg-[#fff7ed]"
                    onClick={() =>
                      void onAlertAction(event._id, "pause_session")
                    }
                  >
                    Pause session
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-[11px] rounded border border-[#dc2626] bg-[#fef2f2]"
                    onClick={() =>
                      void onAlertAction(event._id, "stop_session")
                    }
                  >
                    Stop session
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-[11px] rounded border border-[#7c3aed] bg-[#f5f3ff]"
                    onClick={() =>
                      void onAlertAction(event._id, "request_audit")
                    }
                  >
                    Request audit
                  </button>
                </div>
              )}
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
