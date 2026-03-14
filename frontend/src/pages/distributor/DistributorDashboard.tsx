import { useEffect, useMemo, useState } from "react";
import {
  getConsumers,
  getDistributionRecords,
  getDistributionTokens,
} from "../../services/api";
import FilterBar, {
  type DashboardFilterOptions,
  type DashboardFilterValue,
} from "../../components/FilterBar";
import StatCard, { type DashboardKpi } from "../../components/StatCard";
import ReportTable, {
  type DashboardReportRow,
} from "../../components/ReportTable";
import NotesPanel from "../../components/NotesPanel";

type DashboardConsumer = {
  _id: string;
  status: "Active" | "Inactive" | "Revoked";
  division?: string;
  district?: string;
  upazila?: string;
  unionName?: string;
  ward?: string;
};

type DashboardToken = {
  _id: string;
  status: "Issued" | "Used" | "Cancelled" | "Expired";
  consumerId: string | { _id: string; consumerCode?: string };
  issuedAt?: string;
};

type DashboardRecord = {
  _id: string;
  tokenId: string | { _id: string };
  mismatch: boolean;
};

const ALL = "all";

const defaultFilters: DashboardFilterValue = {
  division: ALL,
  district: ALL,
  upazila: ALL,
  unionName: ALL,
  ward: ALL,
  dealer: ALL,
};

function uniqueOptions(values: Array<string | undefined>) {
  const sorted = Array.from(
    new Set(values.map((v) => String(v || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "bn"));

  return [
    { label: "সব", value: ALL },
    ...sorted.map((value) => ({ label: value, value })),
  ];
}

function tokenConsumerId(token: DashboardToken) {
  if (typeof token.consumerId === "string") return token.consumerId;
  return token.consumerId?._id;
}

function recordTokenId(record: DashboardRecord) {
  if (typeof record.tokenId === "string") return record.tokenId;
  return record.tokenId?._id;
}

function isToday(input?: string) {
  if (!input) return false;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return false;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return d >= start && d < end;
}

export default function DistributorDashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [draftFilters, setDraftFilters] =
    useState<DashboardFilterValue>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<DashboardFilterValue>(defaultFilters);

  const [consumers, setConsumers] = useState<DashboardConsumer[]>([]);
  const [tokens, setTokens] = useState<DashboardToken[]>([]);
  const [records, setRecords] = useState<DashboardRecord[]>([]);

  const filterOptions = useMemo<DashboardFilterOptions>(() => {
    const byDivision = consumers.filter(
      (c) =>
        draftFilters.division === ALL || c.division === draftFilters.division,
    );
    const byDistrict = byDivision.filter(
      (c) =>
        draftFilters.district === ALL || c.district === draftFilters.district,
    );
    const byUpazila = byDistrict.filter(
      (c) => draftFilters.upazila === ALL || c.upazila === draftFilters.upazila,
    );
    const byUnion = byUpazila.filter(
      (c) =>
        draftFilters.unionName === ALL ||
        c.unionName === draftFilters.unionName,
    );

    return {
      divisions: uniqueOptions(consumers.map((c) => c.division)),
      districts: uniqueOptions(byDivision.map((c) => c.district)),
      upazilas: uniqueOptions(byDistrict.map((c) => c.upazila)),
      unions: uniqueOptions(byUpazila.map((c) => c.unionName)),
      wards: uniqueOptions(byUnion.map((c) => c.ward)),
      dealers: [
        { label: "সব", value: ALL },
        { label: "বর্তমান ডিস্ট্রিবিউটর", value: "self" },
      ],
    };
  }, [consumers, draftFilters]);

  const computed = useMemo(() => {
    const filteredConsumers = consumers.filter((consumer) => {
      if (
        appliedFilters.division !== ALL &&
        consumer.division !== appliedFilters.division
      )
        return false;
      if (
        appliedFilters.district !== ALL &&
        consumer.district !== appliedFilters.district
      )
        return false;
      if (
        appliedFilters.upazila !== ALL &&
        consumer.upazila !== appliedFilters.upazila
      )
        return false;
      if (
        appliedFilters.unionName !== ALL &&
        consumer.unionName !== appliedFilters.unionName
      )
        return false;
      if (appliedFilters.ward !== ALL && consumer.ward !== appliedFilters.ward)
        return false;
      return true;
    });

    const consumerIdSet = new Set(filteredConsumers.map((c) => c._id));

    const filteredTokens = tokens.filter((token) => {
      const cId = tokenConsumerId(token);
      return !!cId && consumerIdSet.has(cId);
    });

    const filteredTokenIdSet = new Set(filteredTokens.map((t) => t._id));

    const filteredRecords = records.filter((record) => {
      const tId = recordTokenId(record);
      return !!tId && filteredTokenIdSet.has(tId);
    });

    const issued = filteredTokens.filter((t) => t.status === "Issued").length;
    const cancelled = filteredTokens.filter(
      (t) => t.status === "Cancelled",
    ).length;
    const mismatches = filteredRecords.filter((r) => r.mismatch).length;
    const todayTokens = filteredTokens.filter((t) =>
      isToday(t.issuedAt),
    ).length;
    const successDelivery = filteredRecords.filter((r) => !r.mismatch).length;

    const tokenById = new Map(filteredTokens.map((t) => [t._id, t]));
    const consumerById = new Map(filteredConsumers.map((c) => [c._id, c]));

    const wardWise = new Map<
      string,
      {
        totalConsumers: number;
        familyCount: number;
        cancelOrError: number;
        todayTokens: number;
        successDelivery: number;
        pending: number;
      }
    >();

    for (const consumer of filteredConsumers) {
      const ward = consumer.ward || "অজানা";
      const prev = wardWise.get(ward) || {
        totalConsumers: 0,
        familyCount: 0,
        cancelOrError: 0,
        todayTokens: 0,
        successDelivery: 0,
        pending: 0,
      };
      prev.totalConsumers += 1;
      prev.familyCount += 1;
      wardWise.set(ward, prev);
    }

    for (const token of filteredTokens) {
      const cId = tokenConsumerId(token);
      const ward = (cId && consumerById.get(cId)?.ward) || "অজানা";
      const prev = wardWise.get(ward) || {
        totalConsumers: 0,
        familyCount: 0,
        cancelOrError: 0,
        todayTokens: 0,
        successDelivery: 0,
        pending: 0,
      };

      if (token.status === "Cancelled" || token.status === "Expired")
        prev.cancelOrError += 1;
      if (token.status === "Issued") prev.pending += 1;
      if (isToday(token.issuedAt)) prev.todayTokens += 1;
      wardWise.set(ward, prev);
    }

    for (const record of filteredRecords) {
      const tId = recordTokenId(record);
      const token = tId ? tokenById.get(tId) : undefined;
      const cId = token ? tokenConsumerId(token) : undefined;
      const ward = (cId && consumerById.get(cId)?.ward) || "অজানা";
      const prev = wardWise.get(ward) || {
        totalConsumers: 0,
        familyCount: 0,
        cancelOrError: 0,
        todayTokens: 0,
        successDelivery: 0,
        pending: 0,
      };

      if (record.mismatch) prev.cancelOrError += 1;
      else prev.successDelivery += 1;

      wardWise.set(ward, prev);
    }

    const kpis: DashboardKpi = {
      totalConsumers: filteredConsumers.length,
      familyCount: filteredConsumers.length,
      cancelOrError: cancelled + mismatches,
      todayTokens,
      successDelivery,
      pending: issued,
    };

    const reportRows: DashboardReportRow[] = Array.from(wardWise.entries()).map(
      ([ward, stat], idx) => ({
        serial: idx + 1,
        ward,
        totalConsumers: stat.totalConsumers,
        familyCount: stat.familyCount,
        cancelOrError: stat.cancelOrError,
        todayTokens: stat.todayTokens,
        successDelivery: stat.successDelivery,
        pending: stat.pending,
        note:
          stat.totalConsumers === 0
            ? "⚠ ডেটা পাওয়া যায়নি"
            : "ফিল্টার অনুযায়ী লাইভ সারাংশ",
      }),
    );

    return { kpis, reportRows };
  }, [appliedFilters, consumers, tokens, records]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [consumersData, tokensData, recordsData] = await Promise.all([
        getConsumers({ page: 1, limit: 1000 }),
        getDistributionTokens({ page: 1, limit: 1000 }),
        getDistributionRecords({ page: 1, limit: 1000 }),
      ]);

      setConsumers((consumersData?.consumers || []) as DashboardConsumer[]);
      setTokens((tokensData?.tokens || []) as DashboardToken[]);
      setRecords((recordsData?.records || []) as DashboardRecord[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ড্যাশবোর্ড ডেটা লোড ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const applyFilter = () => {
    setAppliedFilters(draftFilters);
  };

  const resetFilter = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  return (
    <div className="space-y-3">
      {/* breadcrumb/top info row */}
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] text-[#4b5563]">
            হোম <span className="mx-1">›</span> ড্যাশবোর্ড{" "}
            <span className="mx-1">›</span>{" "}
            <span className="font-semibold text-[#111827]">মনিটরিং সারাংশ</span>
          </div>

          <div className="text-[12px] text-[#6b7280]">
            সর্বশেষ আপডেট:{" "}
            <span className="font-semibold text-[#111827]">লাইভ</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Filter section */}
      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            ড্যাশবোর্ড ফিল্টার (লোকেশন/ডিলার নির্বাচন)
          </h2>
        </div>
        <div className="p-3">
          <FilterBar
            value={draftFilters}
            options={filterOptions}
            onChange={setDraftFilters}
            onApply={applyFilter}
            onReset={resetFilter}
            loading={loading}
          />
        </div>
      </section>

      {/* KPI tiles section */}
      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            সারাংশ (KPI টাইল)
          </h2>
        </div>
        <div className="p-3">
          <StatCard kpis={computed.kpis} />
        </div>
      </section>

      {/* Table section */}
      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            মনিটরিং সারাংশ টেবিল
          </h2>
        </div>
        <div className="p-3">
          <ReportTable rows={computed.reportRows} />
        </div>
      </section>

      {loading && (
        <div className="text-[12px] text-[#6b7280]">লোড হচ্ছে...</div>
      )}

      {/* Notes */}
      <NotesPanel />
    </div>
  );
}
