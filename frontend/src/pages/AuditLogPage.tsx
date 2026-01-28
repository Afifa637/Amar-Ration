import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

export default function AuditLogPage() {
  return (
    <div className="space-y-3">
      <PortalSection
        title="অডিট লগ (Immutable)"
        right={
          <div className="flex gap-2">
            <Button variant="secondary">⬇️ এক্সপোর্ট</Button>
            <Button variant="ghost">🔍 অ্যাডভান্স ফিল্টার</Button>
          </div>
        }
      >
        <div className="border rounded overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">সময়</th>
                <th className="border p-2">ইভেন্ট</th>
                <th className="border p-2">রেফারেন্স</th>
                <th className="border p-2">গুরুত্ব</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2 text-center">10:12</td>
                <td className="border p-2">QR স্ক্যান</td>
                <td className="border p-2 text-center">C001</td>
                <td className="border p-2 text-center">
                  <Badge tone="green">Info</Badge>
                </td>
              </tr>
              <tr className="bg-[#fff7ed]">
                <td className="border p-2 text-center">10:18</td>
                <td className="border p-2">ওজন মিসম্যাচ</td>
                <td className="border p-2 text-center">T-1004</td>
                <td className="border p-2 text-center">
                  <Badge tone="red">Critical</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </PortalSection>
    </div>
  );
}
