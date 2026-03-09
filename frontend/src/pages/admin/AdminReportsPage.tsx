import SectionCard from "../../components/SectionCard";

export default function AdminReportsPage() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> রিপোর্ট ও রিকনসিলিয়েশন
      </div>

      <SectionCard title="Reconciliation dashboard">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {["Zone", "Calculated Resource", "Distributed Resource", "Variance", "Status"].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["North", "4.2 MT", "4.2 MT", "0", "Matched"],
                ["South", "3.8 MT", "3.7 MT", "0.1 MT", "Investigate"],
                ["East", "2.5 MT", "2.5 MT", "0", "Matched"],
                ["West", "2.3 MT", "2.1 MT", "0.2 MT", "Fraud Suspected"],
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          ["Daily report", "Token count, scan outcome, stock used"],
          ["Weekly audit report", "Mismatch trend, flagged distributors"],
          ["Monthly beneficiary report", "Active / inactive / revoked consumers"],
        ].map(([title, text]) => (
          <SectionCard key={title} title={title}>
            <p className="text-sm text-[#374151]">{text}</p>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}