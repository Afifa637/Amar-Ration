function Tile({
  title,
  value,
  sub,
  bg,
}: {
  title: string;
  value: string | number;
  sub: string;
  bg: string;
}) {
  return (
    <div className="border border-[#d7dde6] rounded bg-white overflow-hidden">
      <div className={`px-3 py-2 ${bg}`}>
        <div className="text-[12px] font-semibold text-[#1f2d3d]">{title}</div>
      </div>
      <div className="px-3 py-3">
        <div className="text-[22px] font-bold text-[#1f2d3d]">{value}</div>
        <div className="text-[12px] text-[#6b7280] mt-1">{sub}</div>
      </div>
    </div>
  );
}

// ✅ Local demo KPI (later replace by API)
const kpis = {
  totalConsumers: 3400,
  familyCount: 3230,
  cancelOrError: 170,
  todayTokens: 3100,
  successDelivery: 38,
  pending: 0,
};

export default function StatCard() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <Tile title="মোট উপকারভোগী" value={kpis.totalConsumers} sub="নিবন্ধিত উপকারভোগী সংখ্যা" bg="bg-[#e8f1fb]" />
      <Tile title="পরিবার সংখ্যা" value={kpis.familyCount} sub="কার্ড/পরিবার ইউনিট সংখ্যা" bg="bg-[#eaf7ee]" />
      <Tile title="বাতিল/ত্রুটি" value={kpis.cancelOrError} sub="ভুল/বাতিল রেকর্ড সংখ্যা" bg="bg-[#fdecec]" />
      <Tile title="আজকের টোকেন" value={kpis.todayTokens} sub="আজ ইস্যু হওয়া টোকেন" bg="bg-[#f3ecff]" />
      <Tile title="সফল বিতরণ" value={kpis.successDelivery} sub="আজ সফল বিতরণ সংখ্যা" bg="bg-[#e9fbfb]" />
      <Tile title="অমীমাংসিত" value={kpis.pending} sub="অপেক্ষমান/মুলতবি সংখ্যা" bg="bg-[#fff6e6]" />
    </div>
  );
}
