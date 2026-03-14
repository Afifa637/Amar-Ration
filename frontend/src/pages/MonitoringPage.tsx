import { useEffect, useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import {
  createBlacklistEntry,
  createOfflineQueue,
  deactivateBlacklistEntry,
  getBlacklistEntries,
  getMonitoringSummary,
  getOfflineQueue,
  syncAllOfflineQueue,
  syncOfflineQueueItem,
  updateBlacklistEntry,
  type MonitoringBlacklistEntry,
  type MonitoringSummary,
  type OfflineQueueItem,
} from "../services/api";

type BlacklistForm = {
  targetType: "Consumer" | "Distributor";
  targetRefId: string;
  blockType: "Temporary" | "Permanent";
  reason: string;
  active: boolean;
  expiresAt: string;
};

const emptyBlacklistForm: BlacklistForm = {
  targetType: "Consumer",
  targetRefId: "",
  blockType: "Temporary",
  reason: "",
  active: true,
  expiresAt: "",
};

export default function MonitoringPage() {
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [blacklist, setBlacklist] = useState<MonitoringBlacklistEntry[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [openReview, setOpenReview] = useState<MonitoringBlacklistEntry | null>(
    null,
  );
  const [openCreate, setOpenCreate] = useState(false);
  const [blacklistForm, setBlacklistForm] =
    useState<BlacklistForm>(emptyBlacklistForm);
  const [offlinePayload, setOfflinePayload] = useState(
    '{"tokenCode":"T-TEST","consumerCode":"C0001"}',
  );

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, blacklistData, queueData] = await Promise.all([
        getMonitoringSummary(),
        getBlacklistEntries({ limit: 100 }),
        getOfflineQueue({ status: "Pending", limit: 100 }),
      ]);

      setSummary(summaryData);
      setBlacklist(blacklistData.entries);
      setOfflineQueue(queueData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "মনিটরিং ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const onCreateBlacklist = async () => {
    if (!blacklistForm.targetRefId.trim() || !blacklistForm.reason.trim()) {
      setError("টার্গেট আইডি এবং কারণ আবশ্যক");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await createBlacklistEntry({
        targetType: blacklistForm.targetType,
        targetRefId: blacklistForm.targetRefId.trim(),
        blockType: blacklistForm.blockType,
        reason: blacklistForm.reason.trim(),
        active: blacklistForm.active,
        expiresAt: blacklistForm.expiresAt || undefined,
      });

      setMessage("নতুন ব্ল্যাকলিস্ট এন্ট্রি যুক্ত হয়েছে");
      setOpenCreate(false);
      setBlacklistForm(emptyBlacklistForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ব্ল্যাকলিস্ট তৈরি ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onUpdateBlacklist = async () => {
    if (!openReview) return;
    try {
      setLoading(true);
      await updateBlacklistEntry(openReview._id, {
        reason: openReview.reason,
        blockType: openReview.blockType,
        active: openReview.active,
        expiresAt: openReview.expiresAt,
      });
      setMessage("ব্ল্যাকলিস্ট এন্ট্রি আপডেট হয়েছে");
      setOpenReview(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "আপডেট ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onDeactivate = async (entryId: string) => {
    try {
      setLoading(true);
      await deactivateBlacklistEntry(entryId);
      setMessage("এন্ট্রি আনব্লক করা হয়েছে");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "আনব্লক ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onCreateOfflineQueue = async () => {
    try {
      setLoading(true);
      const payload = JSON.parse(offlinePayload) as Record<string, unknown>;
      await createOfflineQueue(payload);
      setMessage("Offline queue item তৈরি হয়েছে");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "অফলাইন কিউ তৈরি ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onSyncOne = async (itemId: string) => {
    try {
      setLoading(true);
      await syncOfflineQueueItem(itemId);
      setMessage("একটি queue item sync হয়েছে");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onSyncAll = async () => {
    try {
      setLoading(true);
      const result = await syncAllOfflineQueue();
      setMessage(`${result?.syncedCount ?? 0} টি item sync হয়েছে`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সব Sync ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {(error || message) && (
        <div
          className={`rounded border px-3 py-2 text-[12px] ${
            error
              ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]"
              : "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"
          }`}
        >
          {error || message}
        </div>
      )}

      {/* ===== System Health Summary ===== */}
      <PortalSection title="সিস্টেম মনিটরিং সারাংশ">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="border p-3 bg-[#f0fdf4]">
            <div className="text-[12px]">সিস্টেম স্ট্যাটাস</div>
            <div className="text-[18px] font-bold text-green-700">
              {summary?.systemStatus === "Normal"
                ? "স্বাভাবিক"
                : summary?.systemStatus || "স্বাভাবিক"}
            </div>
          </div>

          <div className="border p-3 bg-[#fff7ed]">
            <div className="text-[12px]">সতর্কতা (Today)</div>
            <div className="text-[18px] font-bold">
              {summary?.todayAlerts ?? 0}
            </div>
          </div>

          <div className="border p-3 bg-[#fef2f2]">
            <div className="text-[12px]">ক্রিটিকাল ইস্যু</div>
            <div className="text-[18px] font-bold text-red-600">
              {summary?.criticalCount ?? 0}
            </div>
          </div>

          <div className="border p-3 bg-[#eff6ff]">
            <div className="text-[12px]">অফলাইন কিউ</div>
            <div className="text-[18px] font-bold">{offlineQueue.length}</div>
          </div>
        </div>
      </PortalSection>

      {/* ===== QR Expiry & Rotation ===== */}
      <PortalSection
        title="QR কোড এক্সপায়ারি ও রোটেশন"
        right={
          <Button variant="secondary" onClick={() => void loadData()}>
            ♻️ রোটেশন/রিফ্রেশ
          </Button>
        }
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
            <div className="text-[12px] text-red-600 font-semibold">
              প্রযোজ্য নয়
            </div>
          </div>
        </div>

        <p className="mt-2 text-[12px] text-[#374151]">
          QR কোড সময়সীমা অতিক্রম করলে স্বয়ংক্রিয়ভাবে Invalid হয়ে যাবে এবং পুনরায়
          জেনারেশন প্রয়োজন হবে।
        </p>
      </PortalSection>

      {/* ===== Blacklist Management ===== */}
      <PortalSection
        title="ব্ল্যাকলিস্ট মনিটরিং (Fraud Control)"
        right={
          <Button variant="danger" onClick={() => setOpenCreate(true)}>
            🚫 নতুন ব্ল্যাকলিস্ট
          </Button>
        }
      >
        <div className="border rounded overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">টাইপ</th>
                <th className="border p-2">আইডি</th>
                <th className="border p-2">কারণ</th>
                <th className="border p-2">ব্লক টাইপ</th>
                <th className="border p-2">স্ট্যাটাস</th>
                <th className="border p-2">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {blacklist.map((b) => (
                <tr key={b._id}>
                  <td className="border p-2 text-center">{b.targetType}</td>
                  <td className="border p-2 text-center">{b.targetRefId}</td>
                  <td className="border p-2">{b.reason}</td>
                  <td className="border p-2 text-center">{b.blockType}</td>
                  <td className="border p-2 text-center">
                    {b.active ? (
                      <Badge tone="red">ব্লক</Badge>
                    ) : (
                      <Badge tone="green">নিষ্ক্রিয়</Badge>
                    )}
                  </td>
                  <td className="border p-2">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" onClick={() => setOpenReview(b)}>
                        👁️ পর্যালোচনা
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void onDeactivate(b._id)}
                        disabled={!b.active}
                      >
                        🔓 আনব্লক
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {blacklist.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="border p-3 text-center text-[#6b7280]"
                  >
                    {loading ? "লোড হচ্ছে..." : "কোনো ব্ল্যাকলিস্ট ডেটা নেই"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[12px] text-[#374151]">
          ব্ল্যাকলিস্ট এন্ট্রি পরিবর্তন করলে তা অবিলম্বে Audit Log-এ সংরক্ষিত
          হবে।
        </p>
      </PortalSection>

      {/* ===== Offline Sync Queue ===== */}
      <PortalSection
        title="অফলাইন বিতরণ সিঙ্ক কিউ"
        right={
          <Button
            onClick={() => void onSyncAll()}
            disabled={loading || offlineQueue.length === 0}
          >
            🔄 সব সিঙ্ক
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 mb-3">
          <input
            value={offlinePayload}
            onChange={(e) => setOfflinePayload(e.target.value)}
            className="border rounded px-3 py-2 text-[13px]"
            placeholder='{"tokenCode":"T-TEST"}'
          />
          <Button
            variant="secondary"
            onClick={() => void onCreateOfflineQueue()}
            disabled={loading}
          >
            + কিউ আইটেম
          </Button>
        </div>

        {offlineQueue.length === 0 ? (
          <div className="text-[12px] text-[#374151]">
            কোনো পেন্ডিং অফলাইন ডেটা নেই।
          </div>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f8fafc]">
                <tr>
                  <th className="border p-2">কিউ আইডি</th>
                  <th className="border p-2">ডেটা</th>
                  <th className="border p-2">সময়</th>
                  <th className="border p-2">স্ট্যাটাস</th>
                  <th className="border p-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {offlineQueue.map((o) => (
                  <tr key={o._id}>
                    <td className="border p-2 text-center">
                      {o._id.slice(-6)}
                    </td>
                    <td className="border p-2">{JSON.stringify(o.payload)}</td>
                    <td className="border p-2 text-center">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="border p-2 text-center">
                      <Badge tone="yellow">সিঙ্ক অপেক্ষমাণ</Badge>
                    </td>
                    <td className="border p-2 text-center">
                      <Button
                        variant="ghost"
                        onClick={() => void onSyncOne(o._id)}
                        disabled={loading}
                      >
                        সিঙ্ক
                      </Button>
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
              <strong>টাইপ:</strong> {openReview.targetType}
            </div>
            <div>
              <strong>ID:</strong> {openReview.targetRefId}
            </div>
            <div>
              <strong>কারণ:</strong>
              <input
                value={openReview.reason}
                onChange={(e) =>
                  setOpenReview({ ...openReview, reason: e.target.value })
                }
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <strong>ব্লক টাইপ:</strong>
              <select
                value={openReview.blockType}
                onChange={(e) =>
                  setOpenReview({
                    ...openReview,
                    blockType: e.target.value as "Temporary" | "Permanent",
                  })
                }
                className="mt-1 w-full border rounded px-3 py-2 bg-white"
              >
                <option value="Temporary">অস্থায়ী</option>
                <option value="Permanent">স্থায়ী</option>
              </select>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button variant="secondary" onClick={() => setOpenReview(null)}>
                বন্ধ
              </Button>
              <Button
                onClick={() => void onUpdateBlacklist()}
                disabled={loading}
              >
                সংরক্ষণ
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openCreate}
        title="নতুন ব্ল্যাকলিস্ট এন্ট্রি"
        onClose={() => setOpenCreate(false)}
      >
        <div className="space-y-3 text-[13px]">
          <div>
            <div className="mb-1">টার্গেট টাইপ</div>
            <select
              value={blacklistForm.targetType}
              onChange={(e) =>
                setBlacklistForm((prev) => ({
                  ...prev,
                  targetType: e.target.value as "Consumer" | "Distributor",
                }))
              }
              className="w-full border rounded px-3 py-2 bg-white"
            >
              <option value="Consumer">উপকারভোগী</option>
              <option value="Distributor">ডিস্ট্রিবিউটর</option>
            </select>
          </div>
          <div>
            <div className="mb-1">টার্গেট আইডি</div>
            <input
              value={blacklistForm.targetRefId}
              onChange={(e) =>
                setBlacklistForm((prev) => ({
                  ...prev,
                  targetRefId: e.target.value,
                }))
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <div className="mb-1">কারণ</div>
            <textarea
              value={blacklistForm.reason}
              onChange={(e) =>
                setBlacklistForm((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <div className="mb-1">ব্লক টাইপ</div>
            <select
              value={blacklistForm.blockType}
              onChange={(e) =>
                setBlacklistForm((prev) => ({
                  ...prev,
                  blockType: e.target.value as "Temporary" | "Permanent",
                }))
              }
              className="w-full border rounded px-3 py-2 bg-white"
            >
              <option value="Temporary">অস্থায়ী</option>
              <option value="Permanent">স্থায়ী</option>
            </select>
          </div>
          <div>
            <div className="mb-1">মেয়াদ শেষের তারিখ (ঐচ্ছিক)</div>
            <input
              type="date"
              value={blacklistForm.expiresAt}
              onChange={(e) =>
                setBlacklistForm((prev) => ({
                  ...prev,
                  expiresAt: e.target.value,
                }))
              }
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCreate(false)}>
              বাতিল
            </Button>
            <Button onClick={() => void onCreateBlacklist()} disabled={loading}>
              তৈরি করুন
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
