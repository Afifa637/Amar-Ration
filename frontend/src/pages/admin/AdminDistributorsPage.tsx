import SectionCard from "../../components/SectionCard";

const rows = [
  ["D-101", "Ward 01", "Mizan Traders", "Pending", "Approve / Reject"],
  ["D-102", "Ward 03", "Rahman Store", "Active", "Deactivate"],
  ["D-103", "Ward 05", "Sadia Enterprise", "Audit Flagged", "Suspend"],
  ["D-104", "Ward 07", "Tariq Distribution", "Suspended", "Field Verify"],
];

export default function AdminDistributorsPage() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> ডিস্ট্রিবিউটর ম্যানেজমেন্ট
      </div>

      <SectionCard title="Distributor approval workflow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          {[
            ["Pending signup", "12"],
            ["Active distributors", "84"],
            ["Suspended", "05"],
            ["Blacklisted", "02"],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]">
              <div className="text-[#6b7280]">{label}</div>
              <div className="text-2xl font-bold text-[#1f2d3d] mt-1">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Distributor records">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {["Distributor ID", "Ward", "Name", "Status", "Admin Action"].map((head) => (
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

      <SectionCard title="Admin rules">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• Distributor self-activation is disabled.</li>
          <li>• Approval is ward-bound and must be revocable.</li>
          <li>• Fraud or reconciliation failure can trigger deactivation.</li>
          <li>• Every action must be written to immutable audit logs.</li>
        </ul>
      </SectionCard>
    </div>
  );
}