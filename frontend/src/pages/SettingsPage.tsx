import { useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

export default function SettingsPage() {
  const [autoPause, setAutoPause] = useState(true);
  const [offlineMode, setOfflineMode] = useState(true);
  const [smsNotify, setSmsNotify] = useState(true);
  const [appNotify, setAppNotify] = useState(true);

  return (
    <div className="space-y-3">
      {/* ================= POLICY & GOVERNANCE ================= */}
      <PortalSection title="নীতি ও প্রশাসনিক নিয়ন্ত্রণ">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">👤 Distributor অ্যাক্টিভেশন নীতি</div>
            <div className="text-[12px] mt-1">
              নতুন ডিলার শুধুমাত্র Admin অনুমোদনের পর সক্রিয় হবে।
            </div>
            <div className="mt-2 flex gap-2">
              <Badge tone="green">Admin Only</Badge>
              <Badge tone="blue">Time-Bound</Badge>
            </div>
            <Button className="mt-2" variant="secondary">
              নীতি পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⏳ Distributor ক্ষমতার মেয়াদ</div>
            <div className="text-[12px] mt-1">মেয়াদ: ৬ মাস</div>
            <div className="text-[12px] text-[#6b7280]">
              মেয়াদ শেষ হলে পুনরায় অনুমোদন প্রয়োজন।
            </div>
            <Button className="mt-2" variant="secondary">
              সময়সীমা সেট করুন
            </Button>
          </div>
        </div>
      </PortalSection>

      {/* ================= DISTRIBUTION CONTROL ================= */}
      <PortalSection title="বিতরণ ও ওজন নিয়ন্ত্রণ">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⚖️ Weight Mismatch Threshold</div>
            <div className="text-[12px] mt-1">অনুমোদিত বিচ্যুতি: ±৫০ গ্রাম</div>
            <Button className="mt-2" variant="secondary">
              পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⛔ Auto-Pause বিতরণ</div>
            <div className="text-[12px] mt-1">
              ওজন মিসম্যাচ হলে বিতরণ স্বয়ংক্রিয়ভাবে বন্ধ হবে।
            </div>
            <div className="mt-2">
              {autoPause ? (
                <Badge tone="green">Enabled</Badge>
              ) : (
                <Badge tone="red">Disabled</Badge>
              )}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() => setAutoPause(!autoPause)}
            >
              Toggle
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🛑 Manual Override</div>
            <div className="text-[12px] mt-1">
              Admin ছাড়া কেউ Auto-Pause ওভাররাইড করতে পারবে না।
            </div>
            <Badge tone="purple">Admin Restricted</Badge>
          </div>
        </div>
      </PortalSection>

      {/* ================= QR & IDENTITY ================= */}
      <PortalSection title="আমার রেশন কার্ড ও QR সেটিংস">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🪪 QR Expiry Cycle</div>
            <div className="text-[12px] mt-1">বর্তমান: মাসিক</div>
            <Button className="mt-2" variant="secondary">
              সাইকেল পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">♻️ QR Auto Rotation</div>
            <div className="text-[12px] mt-1">
              মেয়াদ শেষে স্বয়ংক্রিয়ভাবে নতুন QR তৈরি হবে।
            </div>
            <Badge tone="green">Enabled</Badge>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🚫 Revoked কার্ড আচরণ</div>
            <div className="text-[12px] mt-1">
              স্ক্যান হলে সম্পূর্ণভাবে রিজেক্ট হবে।
            </div>
            <Badge tone="red">Strict Reject</Badge>
          </div>
        </div>
      </PortalSection>

      {/* ================= TOKEN RULES ================= */}
      <PortalSection title="টোকেন ও রেশন বরাদ্দ নীতি">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🎫 Token Limit</div>
            <div className="text-[12px] mt-1">
              একজন উপকারভোগী দিনে সর্বোচ্চ ১টি টোকেন।
            </div>
            <Button className="mt-2" variant="secondary">
              পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📦 ক্যাটাগরি ভিত্তিক বরাদ্দ</div>
            <div className="text-[12px] mt-1">
              A: ৫ কেজি | B: ৪ কেজি | C: ৩ কেজি
            </div>
            <Button className="mt-2" variant="secondary">
              ক্যাটাগরি সেট করুন
            </Button>
          </div>
        </div>
      </PortalSection>

      {/* ================= FRAUD & BLACKLIST ================= */}
      <PortalSection title="Fraud Detection ও Blacklist নীতি">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🚨 Auto Blacklist Trigger</div>
            <div className="text-[12px] mt-1">
              ৩ বার মিসম্যাচ হলে স্বয়ংক্রিয় ব্লক।
            </div>
            <Button className="mt-2" variant="secondary">
              Threshold পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⏸️ Temporary Block</div>
            <div className="text-[12px] mt-1">সময়কাল: ৭ দিন</div>
            <Button className="mt-2" variant="secondary">
              সময় নির্ধারণ
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🚫 Permanent Block</div>
            <div className="text-[12px] mt-1">
              শুধুমাত্র Admin অনুমোদনে।
            </div>
            <Badge tone="red">Admin Only</Badge>
          </div>
        </div>
      </PortalSection>

      {/* ================= OFFLINE MODE ================= */}
      <PortalSection title="Offline Distribution Mode">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📴 Offline Mode</div>
            <div className="text-[12px] mt-1">
              ইন্টারনেট না থাকলে টোকেন ক্যাশ হবে।
            </div>
            <div className="mt-1">
              {offlineMode ? <Badge tone="green">Enabled</Badge> : <Badge tone="red">Disabled</Badge>}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() => setOfflineMode(!offlineMode)}
            >
              Toggle
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🔄 Sync Conflict Policy</div>
            <div className="text-[12px] mt-1">
              সার্ভার ডেটা সর্বোচ্চ অগ্রাধিকার পাবে।
            </div>
            <Badge tone="blue">Server Wins</Badge>
          </div>
        </div>
      </PortalSection>

      {/* ================= NOTIFICATIONS ================= */}
      <PortalSection title="নোটিফিকেশন ও অ্যালার্ট">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📩 SMS Notification</div>
            <div className="mt-1">
              {smsNotify ? <Badge tone="green">Enabled</Badge> : <Badge tone="red">Disabled</Badge>}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() => setSmsNotify(!smsNotify)}
            >
              Toggle
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📲 App Notification</div>
            <div className="mt-1">
              {appNotify ? <Badge tone="green">Enabled</Badge> : <Badge tone="red">Disabled</Badge>}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() => setAppNotify(!appNotify)}
            >
              Toggle
            </Button>
          </div>
        </div>
      </PortalSection>

      {/* ================= AUDIT & LOG ================= */}
      <PortalSection title="Audit Log ও ডেটা সংরক্ষণ">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🧾 Log Retention</div>
            <div className="text-[12px] mt-1">
              সংরক্ষণ সময়: ৫ বছর
            </div>
            <Button className="mt-2" variant="secondary">
              পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🔒 Immutable Logs</div>
            <div className="text-[12px] mt-1">
              লগ পরিবর্তন বা মুছা যাবে না।
            </div>
            <Badge tone="purple">Enforced</Badge>
          </div>
        </div>
      </PortalSection>
    </div>
  );
}
