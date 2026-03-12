import SectionCard from "../../components/SectionCard";

export default function AdminConsumersPage() {
  const rows = [
    ["C-2001", "017XXXXXXXX", "Father/Mother matched", "Verified", "Generate QR"],
    ["C-2002", "018XXXXXXXX", "Duplicate family flag", "Manual Review", "Inspect"],
    ["C-2003", "019XXXXXXXX", "Documents incomplete", "Pending", "Request Update"],
    ["C-2004", "016XXXXXXXX", "Field verification passed", "Active", "No Action"],
  ];

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> কনজিউমার ও ফ্যামিলি ভেরিফিকেশন
      </div>

      <SectionCard title="Verification pipeline">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          {[
            ["Long list entries", "4,240"],
            ["Verified", "3,870"],
            ["Duplicate flags", "147"],
            ["Inactive", "92"],
            ["Revocation requests", "27"],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]">
              <div className="text-[#6b7280]">{label}</div>
              <div className="text-2xl font-bold text-[#1f2d3d] mt-1">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Family-based identity review">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {["Consumer ID", "Phone", "Family Check", "Status", "Admin Action"].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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

      <SectionCard title="Decision notes">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• Consumer self-signup is disabled under admin-controlled policy.</li>
          <li>• Same family with multiple active claims must be flagged.</li>
          <li>• Inactivation request invalidates eligibility at distribution stage.</li>
          <li>• Admin decision is mandatory for duplicate or suspicious families.</li>
        </ul>
      </SectionCard>
    </div>
  );
}