import FilterBar from "../components/FilterBar";
import StatCard from "../components/StatCard";
import ReportTable from "../components/ReportTable";
import NotesPanel from "../components/NotesPanel";

export default function DistributorDashboard() {
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
            সর্বশেষ আপডেট: <span className="font-semibold text-[#111827]">আজ</span>
          </div>
        </div>
      </div>

      {/* Filter section */}
      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            ড্যাশবোর্ড ফিল্টার (লোকেশন/ডিলার নির্বাচন)
          </h2>
        </div>
        <div className="p-3">
          <FilterBar />
        </div>
      </section>

      {/* KPI tiles section */}
      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">সারাংশ (KPI টাইল)</h2>
        </div>
        <div className="p-3">
          <StatCard />
        </div>
      </section>

      {/* Table section */}
      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">মনিটরিং সারাংশ টেবিল</h2>
        </div>
        <div className="p-3">
          <ReportTable />
        </div>
      </section>

      {/* Notes */}
      <NotesPanel />
    </div>
  );
}
