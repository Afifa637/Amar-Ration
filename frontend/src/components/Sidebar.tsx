import { NavLink } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  getDistributionQuickInfo,
  getDistributionRecords,
  getDistributionTokens,
  getOfflineQueue,
  type SidebarQuickInfo,
} from "../services/api";

const navItem =
  "flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-white/10";
const activeItem = "bg-white/15";

const defaultQuickInfo: SidebarQuickInfo = {
  todayScans: 0,
  mismatchCount: 0,
  offlinePending: 0,
  systemStatus: "Online",
};

function toBanglaDigits(value: number | string) {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value).replace(/\d/g, (d) => bn[Number(d)] || d);
}

export default function Sidebar() {
  const [quickInfo, setQuickInfo] =
    useState<SidebarQuickInfo>(defaultQuickInfo);
  const [loadingQuickInfo, setLoadingQuickInfo] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadQuickInfoFromTables = async () => {
      const [tokensData, recordsData, offlineData] = await Promise.all([
        getDistributionTokens({ page: 1, limit: 1000 }),
        getDistributionRecords({ page: 1, limit: 1000 }),
        getOfflineQueue({ page: 1, limit: 1000, status: "Pending" }),
      ]);

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const todayScans = (tokensData?.tokens || []).filter((token) => {
        const issuedAt = token.issuedAt ? new Date(token.issuedAt) : null;
        if (!issuedAt || Number.isNaN(issuedAt.getTime())) return false;
        return issuedAt >= start && issuedAt < end;
      }).length;

      return {
        todayScans,
        mismatchCount: (recordsData?.records || []).filter(
          (record) => !!record.mismatch,
        ).length,
        offlinePending: offlineData?.pagination?.total || 0,
        systemStatus: "Online",
      } satisfies SidebarQuickInfo;
    };

    const loadQuickInfo = async () => {
      try {
        const data = await getDistributionQuickInfo();
        if (mounted) {
          setQuickInfo(data || defaultQuickInfo);
        }
      } catch {
        try {
          const fallbackData = await loadQuickInfoFromTables();
          if (mounted) {
            setQuickInfo(fallbackData);
          }
        } catch {
          if (mounted) {
            setQuickInfo(defaultQuickInfo);
          }
        }
      } finally {
        if (mounted) {
          setLoadingQuickInfo(false);
        }
      }
    };

    loadQuickInfo();
    const timer = window.setInterval(loadQuickInfo, 30000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const systemStatusText = useMemo(() => {
    const status = (quickInfo.systemStatus || "Online").toLowerCase();
    if (status === "offline") return "অফলাইন";
    if (status === "degraded") return "সতর্ক";
    return "অনলাইন";
  }, [quickInfo.systemStatus]);

  return (
    <div className="h-full p-3 flex flex-col">
      <div className="px-3 py-2 border-b border-white/10 mb-3">
        <div className="text-[13px] opacity-90">মেনু</div>
      </div>

      <nav className="space-y-1">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `${navItem} ${isActive ? activeItem : ""}`
          }
        >
          <span>📊</span>
          <span>ড্যাশবোর্ড</span>
        </NavLink>

        <NavLink
          to="/beneficiaries"
          className={({ isActive }) =>
            `${navItem} ${isActive ? activeItem : ""}`
          }
        >
          <span>👥</span>
          <span>উপকারভোগী</span>
        </NavLink>

        <NavLink
          to="/cards"
          className={({ isActive }) =>
            `${navItem} ${isActive ? activeItem : ""}`
          }
        >
          <span>🪪</span>
          <span>আমার রেশন কার্ড/টোকেন</span>
        </NavLink>

        <NavLink
          to="/stock"
          className={({ isActive }) =>
            `${navItem} ${isActive ? activeItem : ""}`
          }
        >
          <span>📦</span>
          <span>স্টক ও বিতরণ</span>
        </NavLink>

        <NavLink
          to="/audit"
          className={({ isActive }) =>
            `${navItem} ${isActive ? activeItem : ""}`
          }
        >
          <span>📝</span>
          <span>অডিট লগ</span>
        </NavLink>

        <NavLink
          to="/reports"
          className={({ isActive }) =>
            `${navItem} ${isActive ? activeItem : ""}`
          }
        >
          <span>📄</span>
          <span>রিপোর্ট</span>
        </NavLink>

        <NavLink
          to="/monitoring"
          className={({ isActive }) =>
            `${navItem} ${isActive ? activeItem : ""}`
          }
        >
          <span>🛰️</span>
          <span>মনিটরিং</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `${navItem} ${isActive ? activeItem : ""}`
          }
        >
          <span>⚙️</span>
          <span>সেটিংস</span>
        </NavLink>

        <NavLink
          to="/help"
          className={({ isActive }) =>
            `${navItem} ${isActive ? activeItem : ""}`
          }
        >
          <span>❓</span>
          <span>সহায়তা</span>
        </NavLink>
      </nav>

      {/* Quick panel */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="text-[12px] opacity-90 px-3 mb-2">দ্রুত তথ্য</div>

        <div className="px-3 space-y-2 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="opacity-90">আজ স্ক্যান</span>
            <span className="font-semibold">
              {loadingQuickInfo ? "..." : toBanglaDigits(quickInfo.todayScans)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-90">মিসম্যাচ</span>
            <span className="font-semibold text-[#ffb4b4]">
              {loadingQuickInfo
                ? "..."
                : toBanglaDigits(quickInfo.mismatchCount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-90">অফলাইন কিউ</span>
            <span className="font-semibold">
              {loadingQuickInfo
                ? "..."
                : toBanglaDigits(quickInfo.offlinePending)}
            </span>
          </div>
        </div>

        <div className="px-3 mt-3 text-[12px] opacity-90">
          স্ট্যাটাস:{" "}
          <span className="font-semibold text-[#c7f9cc]">
            {systemStatusText}
          </span>
        </div>
      </div>
    </div>
  );
}
