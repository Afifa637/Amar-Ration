import SectionCard from "../../components/SectionCard";

export default function AdminAuditPage() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> অডিট, ফ্রড ও ব্ল্যাকলিস্ট
      </div>

      <SectionCard title="Audit signal summary">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["Open alerts", "03"],
            ["Weight mismatches", "11"],
            ["Stock anomalies", "04"],
            ["Blacklist candidates", "10"],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]">
              <div className="text-sm text-[#6b7280]">{label}</div>
              <div className="text-2xl font-bold text-[#1f2d3d] mt-1">{value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Immutable audit logs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {["Timestamp", "Event", "Actor", "Outcome"].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["09:05 AM", "QR Scan", "Distributor D-101", "Accepted"],
                ["09:11 AM", "Weight Check", "IoT Sensor W-03", "Mismatch logged"],
                ["09:14 AM", "Stock Update", "System", "Variance detected"],
                ["09:18 AM", "Admin Action", "Central Admin", "Distributor suspended"],
              ].map((row) => (
                <tr key={row.join("-")} className="odd:bg-white even:bg-[#fafbfc]">
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

      <SectionCard title="Blacklist policy">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• Fraudulent consumer or distributor can be temporarily blocked.</li>
          <li>• Repeated reconciliation failure can trigger permanent blacklist.</li>
          <li>• Every blacklist event must include reason and approving admin.</li>
          <li>• Blacklisted entities cannot generate tokens or complete distribution.</li>
        </ul>
      </SectionCard>
    </div>
  );
}