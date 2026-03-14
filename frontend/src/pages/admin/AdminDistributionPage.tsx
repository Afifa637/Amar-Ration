import SectionCard from "../../components/SectionCard";

export default function AdminDistributionPage() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> টোকেন ও ডিস্ট্রিবিউশন কন্ট্রোল
      </div>

      <SectionCard title="Distribution day controls">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["Valid scans", "6,742"],
            ["Rejected scans", "273"],
            ["Tokens generated", "6,420"],
            ["Paused points", "02"],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]">
              <div className="text-sm text-[#6b7280]">{label}</div>
              <div className="text-2xl font-bold text-[#1f2d3d] mt-1">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Real-time validation logic">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• QR validity check</li>
          <li>• Consumer active/inactive status check</li>
          <li>• Duplicate family conflict check</li>
          <li>• Token generation only for valid consumers</li>
          <li>• Used token cannot be reused</li>
        </ul>
      </SectionCard>

      <SectionCard title="IoT weight and stock monitoring">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {["Point", "Expected Weight", "Actual Weight", "Status", "Action"].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Ward-01", "30kg", "30kg", "Matched", "Continue"],
                ["Ward-03", "30kg", "28.8kg", "Mismatch", "Pause + Alert"],
                ["Ward-05", "20kg", "20kg", "Matched", "Continue"],
                ["Ward-07", "25kg", "24.1kg", "Mismatch", "Flag"],
              ].map((row) => (
                <tr key={row[0]} className="odd:bg-white even:bg-[#fafbfc]">
                  {row.map((cell) => (
                    <td key={cell} className="p-2 border border-[#d7dde6]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}