import { useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";

type BlacklistItem = {
  id: string;
  type: "Consumer" | "Distributor";
  reason: string;
  status: "Blocked" | "Under Review";
};

const blacklistDemo: BlacklistItem[] = [
  { id: "C004", type: "Consumer", reason: "ডুপ্লিকেট পরিবার", status: "Blocked" },
  { id: "D012", type: "Distributor", reason: "ওজন জালিয়াতি", status: "Under Review" },
];

const offlineQueue = [
  { token: "T-1022", consumer: "C019", time: "11:32 AM" },
  { token: "T-1023", consumer: "C021", time: "11:34 AM" },
];

export default function MonitoringPage() {
  const [openReview, setOpenReview] = useState<BlacklistItem | null>(null);

  return (
    <div className="space-y-3">
      {/* ===== System Health Summary ===== */}
      <PortalSection title="সিস্টেম মনিটরিং সারাংশ">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="border p-3 bg-[#f0fdf4]">
            <div className="text-[12px]">সিস্টেম স্ট্যাটাস</div>
            <div className="text-[18px] font-bold text-green-700">স্বাভাবিক</div>
          </div>

          <div className="border p-3 bg-[#fff7ed]">
            <div className="text-[12px]">সতর্কতা (Today)</div>
            <div className="text-[18px] font-bold">৩</div>
          </div>

          <div className="border p-3 bg-[#fef2f2]">
            <div className="text-[12px]">ক্রিটিকাল ইস্যু</div>
            <div className="text-[18px] font-bold text-red-600">১</div>
          </div>

          <div className="border p-3 bg-[#eff6ff]">
            <div className="text-[12px]">Offline Queue</div>
            <div className="text-[18px] font-bold">{offlineQueue.length}</div>
          </div>
        </div>
      </PortalSection>

      {/* ===== QR Expiry & Rotation ===== */}
      <PortalSection
        title="QR কোড এক্সপায়ারি ও রোটেশন"
        right={<Button variant="secondary">♻️ রোটেশন ট্রিগার</Button>}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">বর্তমান সাইকেল</div>
            <div className="text-[12px]">মাসিক (৩০ দিন)</div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">পরবর্তী রোটেশন</div>
            <div className="text-[12px] text-[#b45309]">৭ দিন পর</div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">মেয়াদোত্তীর্ণ QR</div>
            <div className="text-[12px] text-red-600 font-semibold">১২ টি</div>
          </div>
        </div>

        <p className="mt-2 text-[12px] text-[#374151]">
          QR কোড সময়সীমা অতিক্রম করলে স্বয়ংক্রিয়ভাবে Invalid হয়ে যাবে এবং পুনরায় জেনারেশন প্রয়োজন হবে।
        </p>
      </PortalSection>

      {/* ===== Blacklist Management ===== */}
      <PortalSection
        title="ব্ল্যাকলিস্ট মনিটরিং (Fraud Control)"
        right={<Button variant="danger">🚫 নতুন ব্ল্যাকলিস্ট</Button>}
      >
        <div className="border rounded overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">টাইপ</th>
                <th className="border p-2">আইডি</th>
                <th className="border p-2">কারণ</th>
                <th className="border p-2">স্ট্যাটাস</th>
                <th className="border p-2">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {blacklistDemo.map((b) => (
                <tr key={b.id}>
                  <td className="border p-2 text-center">{b.type}</td>
                  <td className="border p-2 text-center">{b.id}</td>
                  <td className="border p-2">{b.reason}</td>
                  <td className="border p-2 text-center">
                    {b.status === "Blocked" ? (
                      <Badge tone="red">Blocked</Badge>
                    ) : (
                      <Badge tone="yellow">Under Review</Badge>
                    )}
                  </td>
                  <td className="border p-2">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" onClick={() => setOpenReview(b)}>
                        👁️ পর্যালোচনা
                      </Button>
                      <Button variant="secondary">🔓 আনব্লক</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[12px] text-[#374151]">
          ব্ল্যাকলিস্ট এন্ট্রি পরিবর্তন করলে তা অবিলম্বে Audit Log-এ সংরক্ষিত হবে।
        </p>
      </PortalSection>

      {/* ===== Offline Sync Queue ===== */}
      <PortalSection
        title="Offline Distribution Sync Queue"
        right={<Button>🔄 Sync Now</Button>}
      >
        {offlineQueue.length === 0 ? (
          <div className="text-[12px] text-[#374151]">কোনো Pending Offline ডেটা নেই।</div>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f8fafc]">
                <tr>
                  <th className="border p-2">Token</th>
                  <th className="border p-2">Consumer</th>
                  <th className="border p-2">সময়</th>
                  <th className="border p-2">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {offlineQueue.map((o) => (
                  <tr key={o.token}>
                    <td className="border p-2 text-center">{o.token}</td>
                    <td className="border p-2 text-center">{o.consumer}</td>
                    <td className="border p-2 text-center">{o.time}</td>
                    <td className="border p-2 text-center">
                      <Badge tone="yellow">Pending Sync</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalSection>

      {/* ===== Review Modal ===== */}
      <Modal
        open={!!openReview}
        title="ব্ল্যাকলিস্ট রিভিউ"
        onClose={() => setOpenReview(null)}
      >
        {openReview && (
          <div className="space-y-2 text-[13px]">
            <div>
              <strong>টাইপ:</strong> {openReview.type}
            </div>
            <div>
              <strong>ID:</strong> {openReview.id}
            </div>
            <div>
              <strong>কারণ:</strong> {openReview.reason}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button variant="secondary" onClick={() => setOpenReview(null)}>
                বন্ধ
              </Button>
              <Button variant="danger">স্থায়ী ব্লক</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
