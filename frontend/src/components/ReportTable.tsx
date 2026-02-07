const reportColumns = [
  "ক্রমিক",
  "ওয়ার্ড",
  "মোট উপকারভোগী",
  "পরিবার সংখ্যা",
  "বাতিল/ত্রুটি",
  "আজকের টোকেন",
  "সফল বিতরণ",
  "অমীমাংসিত",
  "মন্তব্য",
];

const reportRows: (string | number)[][] = [
  [1, "ওয়ার্ড-০১", 3400, 3230, 170, 3100, 38, 0, "ডেমো সারাংশ"],
  [2, "ওয়ার্ড-০২", 0, 0, 0, 0, 0, 0, "⚠ ডেটা পাওয়া যায়নি"],
];

export default function ReportTable() {
  return (
    <div className="border border-[#d7dde6] rounded overflow-hidden">
      <div className="bg-[#f3f5f8] px-3 py-2 border-b border-[#d7dde6]">
        <div className="text-center text-[13px] font-semibold text-[#b91c1c]">
          আমার রেশন মনিটরিং: সারসংক্ষেপ টেবিল
        </div>
        <div className="text-center text-[12px] text-[#6b7280] mt-1">
          (ডেমো ডেটা — পরে API থেকে রিয়েল ডেটা বসবে)
        </div>
      </div>

      <div className="overflow-x-auto bg-white">
        <table className="min-w-[1100px] w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#e9edf3] text-[#111827]">
              {reportColumns.map((c) => (
                <th
                  key={c}
                  className="border border-[#cfd6e0] px-2 py-2 text-center font-semibold"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {reportRows.map((r, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className={`border border-[#cfd6e0] px-2 py-2 text-center ${
                      typeof cell === "string" && cell.includes("⚠")
                        ? "text-[#b91c1c] font-semibold"
                        : ""
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
