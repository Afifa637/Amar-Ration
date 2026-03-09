import { useEffect, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import api from "../../services/api";

type SettingsMap = Record<string, string | number | boolean | null>;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");
      const res = (await api.get("/distributor/settings")) as SettingsMap;
      setSettings(res || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেটিংস লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const boolBadge = (value: unknown) =>
    value ? <Badge tone="green">Enabled</Badge> : <Badge tone="red">Disabled</Badge>;

  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-red-600">{error}</div>}

      <PortalSection
        title="নীতি ও প্রশাসনিক নিয়ন্ত্রণ"
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadSettings}>
              {loading ? "লোড..." : "🔄 রিফ্রেশ"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⚖️ Weight Mismatch Threshold</div>
            <div className="text-[12px] mt-1">
              {String(settings.weightThresholdKg ?? "ব্যাকএন্ডে key যোগ করুন")} কেজি
            </div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⛔ Auto-Pause বিতরণ</div>
            <div className="mt-2">{boolBadge(settings.autoPauseDistribution)}</div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📴 Offline Mode</div>
            <div className="mt-2">{boolBadge(settings.offlineMode)}</div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🪪 QR Expiry Policy</div>
            <div className="text-[12px] mt-1">{String(settings.qrExpiryPolicy ?? "ব্যাকএন্ডে key যোগ করুন")}</div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📩 SMS Notification</div>
            <div className="mt-2">{boolBadge(settings.smsNotification)}</div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📲 App Notification</div>
            <div className="mt-2">{boolBadge(settings.appNotification)}</div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🎫 Token Limit Per Day</div>
            <div className="text-[12px] mt-1">{String(settings.tokenLimitPerDay ?? "ব্যাকএন্ডে key যোগ করুন")}</div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🚨 Auto Blacklist Trigger</div>
            <div className="text-[12px] mt-1">{String(settings.autoBlacklistThreshold ?? "ব্যাকএন্ডে key যোগ করুন")}</div>
          </div>
        </div>
      </PortalSection>

      <PortalSection title="সেটিংস নোট">
        <div className="text-[12px] text-[#374151]">
          এই পেজ এখন backend `SystemSetting` collection থেকে read-only data লোড করছে।  
          update/toggle action চালাতে `PATCH /api/distributor/settings/:key` বা admin settings API পরে যোগ করতে হবে।
        </div>
      </PortalSection>
    </div>
  );
}