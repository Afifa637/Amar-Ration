import SectionCard from "../../components/SectionCard";

function MetricCard({
  title,
  value,
  sub,
  bg,
}: {
  title: string;
  value: string;
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

const metrics = [
  { title: "Pending Distributors", value: "12", sub: "approval অপেক্ষায়", bg: "bg-[#e8f1fb]" },
  { title: "Active Consumers", value: "34,280", sub: "verified active beneficiaries", bg: "bg-[#eaf7ee]" },
  { title: "Family Duplicate Flags", value: "147", sub: "manual decision required", bg: "bg-[#fdecec]" },
  { title: "Issued QR Cards", value: "31,905", sub: "active or recently rotated", bg: "bg-[#f3ecff]" },
  { title: "Today Tokens", value: "6,420", sub: "distribution-day generated", bg: "bg-[#e9fbfb]" },
  { title: "Audit Alerts", value: "03", sub: "weight mismatch / stock anomaly", bg: "bg-[#fff6e6]" },
];

const alerts = [
  ["W-07 Distributor", "Weight mismatch detected in 2 transactions", "High"],
  ["Family Cluster #F-203", "Multiple active claims from same parent NID", "Medium"],
  ["QR Batch February", "312 cards due for expiry & rotation", "Info"],
  ["Distributor D-104", "Pending field verification after audit failure", "High"],
];

export default function AdminDashboard() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] text-[#4b5563]">
            হোম <span className="mx-1">›</span> অ্যাডমিন <span className="mx-1">›</span>
            <span className="font-semibold text-[#111827]"> কন্ট্রোল ড্যাশবোর্ড</span>
          </div>
          <div className="text-[12px] text-[#6b7280]">
            সিস্টেম অবস্থা: <span className="font-semibold text-[#16679c]">লাইভ মনিটরিং</span>
          </div>
        </div>
      </div>

      <SectionCard title="অ্যাডমিন কোর KPI">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {metrics.map((item) => (
            <MetricCard key={item.title} {...item} />
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <SectionCard title="আজকের অপারেশন সারাংশ">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f3f5f8] text-left text-[#374151]">
                  <th className="p-2 border border-[#d7dde6]">মেট্রিক</th>
                  <th className="p-2 border border-[#d7dde6]">মান</th>
                  <th className="p-2 border border-[#d7dde6]">নোট</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["QR scans", "7,015", "Valid: 6,742 | Rejected: 273"],
                  ["Issued tokens", "6,420", "Category A/B/C mixed"],
                  ["Stock deducted", "12.8 MT", "reconciled with token volume"],
                  ["Offline sync queue", "24", "awaiting network sync"],
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

        <SectionCard title="ফ্রড/অডিট এলার্ট">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f3f5f8] text-left text-[#374151]">
                  <th className="p-2 border border-[#d7dde6]">Source</th>
                  <th className="p-2 border border-[#d7dde6]">Issue</th>
                  <th className="p-2 border border-[#d7dde6]">Priority</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((row) => (
                  <tr key={row[0]} className="odd:bg-white even:bg-[#fafbfc]">
                    <td className="p-2 border border-[#d7dde6]">{row[0]}</td>
                    <td className="p-2 border border-[#d7dde6]">{row[1]}</td>
                    <td className="p-2 border border-[#d7dde6]">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <SectionCard title="Distributor lifecycle">
          <ul className="space-y-2 text-sm text-[#374151]">
            <li>• New signup → pending review → approve/reject</li>
            <li>• Active distributors are ward-bound and revocable</li>
            <li>• Audit failure triggers temporary suspension</li>
            <li>• Blacklisted distributors cannot access distribution actions</li>
          </ul>
        </SectionCard>

        <SectionCard title="Consumer identity safeguards">
          <ul className="space-y-2 text-sm text-[#374151]">
            <li>• Consumer NID + Father NID + Mother NID matching</li>
            <li>• Duplicate family flag for same household claims</li>
            <li>• Verified consumers receive OMS QR ration card</li>
            <li>• Inactive / revoked cards fail at scan stage</li>
          </ul>
        </SectionCard>

        <SectionCard title="Admin action queue">
          <ul className="space-y-2 text-sm text-[#374151]">
            <li>• 12 distributor approval requests</li>
            <li>• 27 consumer inactivation requests</li>
            <li>• 08 blacklist review submissions</li>
            <li>• 03 reconciliation mismatches pending closure</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}