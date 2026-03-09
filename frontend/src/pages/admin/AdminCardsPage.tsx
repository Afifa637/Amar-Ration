import SectionCard from "../../components/SectionCard";

export default function AdminCardsPage() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> OMS কার্ড ও QR কন্ট্রোল
      </div>

      <SectionCard title="QR card control summary">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["Issued cards", "31,905"],
            ["Active QR", "30,980"],
            ["Inactive / revoked", "625"],
            ["Due for rotation", "312"],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]">
              <div className="text-sm text-[#6b7280]">{label}</div>
              <div className="text-2xl font-bold text-[#1f2d3d] mt-1">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="QR lifecycle policy">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                <th className="p-2 border border-[#d7dde6]">State</th>
                <th className="p-2 border border-[#d7dde6]">Meaning</th>
                <th className="p-2 border border-[#d7dde6]">Scan Result</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Active", "Verified consumer can join distribution", "Allow token generation"],
                ["Inactive", "Consumer temporarily blocked or unapproved", "Reject scan"],
                ["Revoked", "Card invalidated after admin action", "Reject scan + log event"],
                ["Expired", "Rotation window reached", "Require regenerated QR"],
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

      <SectionCard title="Admin actions">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• Generate OMS ration card after successful verification.</li>
          <li>• Revoke QR immediately after approved inactivation.</li>
          <li>• Rotate time-bound QR per cycle to prevent card reuse.</li>
          <li>• Log every QR state change for audit traceability.</li>
        </ul>
      </SectionCard>
    </div>
  );
}