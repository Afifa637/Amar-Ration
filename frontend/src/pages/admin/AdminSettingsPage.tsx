import SectionCard from "../../components/SectionCard";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> সিস্টেম সেটিংস
      </div>

      <SectionCard title="Core policy settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[#374151]">
          <div className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]">
            <div className="font-semibold text-[#1f2d3d] mb-2">Authentication</div>
            <ul className="space-y-2">
              <li>• Admin login uses fixed email and password</li>
              <li>• Distributor activation remains admin-controlled</li>
              <li>• Session stores user role for route protection</li>
            </ul>
          </div>

          <div className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]">
            <div className="font-semibold text-[#1f2d3d] mb-2">QR & token policy</div>
            <ul className="space-y-2">
              <li>• QR can be active, inactive, revoked, or expired</li>
              <li>• Token is generated only after valid QR scan</li>
              <li>• Offline token cache syncs when internet returns</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Recommended backend-controlled settings">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• Store admin credentials in server environment variables.</li>
          <li>• Keep QR expiry duration configurable by distribution cycle.</li>
          <li>• Maintain blacklist duration policy with temporary/permanent modes.</li>
          <li>• Trigger SMS/app notifications from backend services.</li>
        </ul>
      </SectionCard>
    </div>
  );
}