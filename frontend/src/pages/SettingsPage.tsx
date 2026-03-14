import { useEffect, useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import {
  AUTH_STORAGE_KEY,
  changeMyPassword,
  getDistributorSettings,
  resetDistributorSettings,
  updateDistributorSettings,
  updateMyProfile,
  type DistributorSettings,
  type SettingsProfile,
} from "../services/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<DistributorSettings | null>(null);
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDistributorSettings();
      setSettings(data.settings);
      setProfile(data.profile || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেটিংস লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const patchSettings = (
    updater: (prev: DistributorSettings) => DistributorSettings,
  ) => {
    setSettings((prev) => (prev ? updater(prev) : prev));
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      setLoading(true);
      setError("");
      await updateDistributorSettings(settings);
      setMessage("সেটিংস সংরক্ষণ হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেটিংস সংরক্ষণ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onResetSettings = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await resetDistributorSettings();
      if (result?.settings) {
        setSettings(result.settings);
      }
      setMessage("ডিফল্ট সেটিংস রিস্টোর হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিসেট ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    try {
      setLoading(true);
      setError("");
      const result = await updateMyProfile(profile);
      if (result?.user) {
        setProfile(result.user);

        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as {
            user?: SettingsProfile;
            token?: string;
          };
          if (parsed?.user) {
            parsed.user.name = result.user.name || parsed.user.name;
            parsed.user.officeAddress = result.user.officeAddress;
            parsed.user.wardNo = result.user.wardNo;
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
          }
        }
      }
      setMessage("প্রোফাইল আপডেট হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "প্রোফাইল আপডেট ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword) {
      setError("বর্তমান এবং নতুন পাসওয়ার্ড দিন");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("পাসওয়ার্ড পরিবর্তন হয়েছে");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "পাসওয়ার্ড পরিবর্তন ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="text-[12px] border rounded px-3 py-2 bg-[#fef2f2] border-[#fecaca] text-[#991b1b]">
            {error}
          </div>
        )}
        <div className="text-[12px] text-[#6b7280]">
          {loading ? "লোড হচ্ছে..." : "সেটিংস পাওয়া যায়নি"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(error || message) && (
        <div
          className={`rounded border px-3 py-2 text-[12px] ${error ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]" : "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"}`}
        >
          {error || message}
        </div>
      )}

      <PortalSection
        title="আমার প্রোফাইল"
        right={
          <Button onClick={() => void saveProfile()} disabled={loading}>
            প্রোফাইল সংরক্ষণ
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px]">
          <input
            className="border rounded px-3 py-2"
            placeholder="নাম"
            value={profile?.name || ""}
            onChange={(e) =>
              setProfile((prev) => ({
                ...(prev || { name: "" }),
                name: e.target.value,
              }))
            }
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="ফোন"
            value={profile?.phone || ""}
            onChange={(e) =>
              setProfile((prev) => ({
                ...(prev || { name: "" }),
                phone: e.target.value,
              }))
            }
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="ওয়ার্ড নম্বর"
            value={profile?.wardNo || ""}
            onChange={(e) =>
              setProfile((prev) => ({
                ...(prev || { name: "" }),
                wardNo: e.target.value,
              }))
            }
          />
          <input
            className="border rounded px-3 py-2 md:col-span-2"
            placeholder="অফিস ঠিকানা"
            value={profile?.officeAddress || ""}
            onChange={(e) =>
              setProfile((prev) => ({
                ...(prev || { name: "" }),
                officeAddress: e.target.value,
              }))
            }
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Ward"
            value={profile?.ward || ""}
            onChange={(e) =>
              setProfile((prev) => ({
                ...(prev || { name: "" }),
                ward: e.target.value,
              }))
            }
          />
        </div>
      </PortalSection>

      {/* ================= POLICY & GOVERNANCE ================= */}
      <PortalSection title="নীতি ও প্রশাসনিক নিয়ন্ত্রণ">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">
              👤 Distributor অ্যাক্টিভেশন নীতি
            </div>
            <div className="text-[12px] mt-1">
              নতুন ডিলার শুধুমাত্র Admin অনুমোদনের পর সক্রিয় হবে।
            </div>
            <div className="mt-2 flex gap-2">
              <Badge tone="green">শুধু এডমিন</Badge>
              <Badge tone="blue">সময়-সীমাবদ্ধ</Badge>
            </div>
            <div className="mt-2 text-[12px]">
              এডমিন অনুমোদন:
              <select
                className="ml-2 border rounded px-2 py-1 bg-white"
                value={settings.policy.adminApprovalRequired ? "yes" : "no"}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    policy: {
                      ...prev.policy,
                      adminApprovalRequired: e.target.value === "yes",
                    },
                  }))
                }
              >
                <option value="yes">প্রয়োজন</option>
                <option value="no">প্রয়োজন নেই</option>
              </select>
            </div>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⏳ Distributor ক্ষমতার মেয়াদ</div>
            <div className="text-[12px] mt-1">
              মেয়াদ: {settings.policy.authorityMonths} মাস
            </div>
            <div className="text-[12px] text-[#6b7280]">
              মেয়াদ শেষ হলে পুনরায় অনুমোদন প্রয়োজন।
            </div>
            <input
              type="number"
              min={1}
              value={settings.policy.authorityMonths}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  policy: {
                    ...prev.policy,
                    authorityMonths: Number(e.target.value) || 1,
                  },
                }))
              }
              className="mt-2 w-full border rounded px-3 py-2 text-[12px]"
            />
          </div>
        </div>
      </PortalSection>

      {/* ================= DISTRIBUTION CONTROL ================= */}
      <PortalSection title="বিতরণ ও ওজন নিয়ন্ত্রণ">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⚖️ ওজন মিসম্যাচ থ্রেশহোল্ড</div>
            <div className="text-[12px] mt-1">
              অনুমোদিত বিচ্যুতি: ±
              {(settings.distribution.weightThresholdKg * 1000).toFixed(0)}{" "}
              গ্রাম
            </div>
            <input
              type="number"
              min={0}
              step={0.01}
              value={settings.distribution.weightThresholdKg}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  distribution: {
                    ...prev.distribution,
                    weightThresholdKg: Number(e.target.value) || 0,
                  },
                }))
              }
              className="mt-2 w-full border rounded px-3 py-2 text-[12px]"
            />
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⛔ Auto-Pause বিতরণ</div>
            <div className="text-[12px] mt-1">
              ওজন মিসম্যাচ হলে বিতরণ স্বয়ংক্রিয়ভাবে বন্ধ হবে।
            </div>
            <div className="mt-2">
              {settings.distribution.autoPauseOnMismatch ? (
                <Badge tone="green">চালু</Badge>
              ) : (
                <Badge tone="red">বন্ধ</Badge>
              )}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() =>
                patchSettings((prev) => ({
                  ...prev,
                  distribution: {
                    ...prev.distribution,
                    autoPauseOnMismatch: !prev.distribution.autoPauseOnMismatch,
                  },
                }))
              }
            >
              পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🛑 Manual Override</div>
            <div className="text-[12px] mt-1">
              Admin ছাড়া কেউ Auto-Pause ওভাররাইড করতে পারবে না।
            </div>
            <Badge tone="purple">এডমিন-নিয়ন্ত্রিত</Badge>
          </div>
        </div>
      </PortalSection>

      {/* ================= QR & IDENTITY ================= */}
      <PortalSection title="আমার রেশন কার্ড ও QR সেটিংস">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🪪 QR মেয়াদ চক্র</div>
            <div className="text-[12px] mt-1">
              বর্তমান: {settings.qr.expiryCycleDays} দিন
            </div>
            <input
              type="number"
              min={1}
              value={settings.qr.expiryCycleDays}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  qr: {
                    ...prev.qr,
                    expiryCycleDays: Number(e.target.value) || 1,
                  },
                }))
              }
              className="mt-2 w-full border rounded px-3 py-2 text-[12px]"
            />
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">♻️ QR Auto Rotation</div>
            <div className="text-[12px] mt-1">
              মেয়াদ শেষে স্বয়ংক্রিয়ভাবে নতুন QR তৈরি হবে।
            </div>
            <Badge tone={settings.qr.autoRotation ? "green" : "red"}>
              {settings.qr.autoRotation ? "চালু" : "বন্ধ"}
            </Badge>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() =>
                patchSettings((prev) => ({
                  ...prev,
                  qr: { ...prev.qr, autoRotation: !prev.qr.autoRotation },
                }))
              }
            >
              পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🚫 Revoked কার্ড আচরণ</div>
            <div className="text-[12px] mt-1">
              স্ক্যান হলে সম্পূর্ণভাবে রিজেক্ট হবে।
            </div>
            <Badge tone="red">কঠোর বাতিল</Badge>
          </div>
        </div>
      </PortalSection>

      {/* ================= TOKEN RULES ================= */}
      <PortalSection title="টোকেন ও রেশন বরাদ্দ নীতি">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🎫 Token Limit</div>
            <div className="text-[12px] mt-1">
              একজন উপকারভোগী দিনে সর্বোচ্চ{" "}
              {settings.distribution.tokenPerConsumerPerDay}টি টোকেন।
            </div>
            <input
              type="number"
              min={1}
              value={settings.distribution.tokenPerConsumerPerDay}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  distribution: {
                    ...prev.distribution,
                    tokenPerConsumerPerDay: Number(e.target.value) || 1,
                  },
                }))
              }
              className="mt-2 w-full border rounded px-3 py-2 text-[12px]"
            />
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📦 ক্যাটাগরি ভিত্তিক বরাদ্দ</div>
            <div className="text-[12px] mt-1">
              A: {settings.allocation.A} | B: {settings.allocation.B} | C:{" "}
              {settings.allocation.C}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input
                type="number"
                min={0}
                value={settings.allocation.A}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    allocation: {
                      ...prev.allocation,
                      A: Number(e.target.value) || 0,
                    },
                  }))
                }
                className="border rounded px-2 py-1"
              />
              <input
                type="number"
                min={0}
                value={settings.allocation.B}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    allocation: {
                      ...prev.allocation,
                      B: Number(e.target.value) || 0,
                    },
                  }))
                }
                className="border rounded px-2 py-1"
              />
              <input
                type="number"
                min={0}
                value={settings.allocation.C}
                onChange={(e) =>
                  patchSettings((prev) => ({
                    ...prev,
                    allocation: {
                      ...prev.allocation,
                      C: Number(e.target.value) || 0,
                    },
                  }))
                }
                className="border rounded px-2 py-1"
              />
            </div>
          </div>
        </div>
      </PortalSection>

      {/* ================= FRAUD & BLACKLIST ================= */}
      <PortalSection title="Fraud Detection ও Blacklist নীতি">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🚨 Auto Blacklist Trigger</div>
            <div className="text-[12px] mt-1">
              {settings.fraud.autoBlacklistMismatchCount} বার মিসম্যাচ হলে
              স্বয়ংক্রিয় ব্লক।
            </div>
            <input
              type="number"
              min={1}
              value={settings.fraud.autoBlacklistMismatchCount}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  fraud: {
                    ...prev.fraud,
                    autoBlacklistMismatchCount: Number(e.target.value) || 1,
                  },
                }))
              }
              className="mt-2 w-full border rounded px-3 py-2 text-[12px]"
            />
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">⏸️ Temporary Block</div>
            <div className="text-[12px] mt-1">
              সময়কাল: {settings.fraud.temporaryBlockDays} দিন
            </div>
            <input
              type="number"
              min={1}
              value={settings.fraud.temporaryBlockDays}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  fraud: {
                    ...prev.fraud,
                    temporaryBlockDays: Number(e.target.value) || 1,
                  },
                }))
              }
              className="mt-2 w-full border rounded px-3 py-2 text-[12px]"
            />
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🚫 Permanent Block</div>
            <div className="text-[12px] mt-1">শুধুমাত্র Admin অনুমোদনে।</div>
            <Badge tone="red">শুধু এডমিন</Badge>
          </div>
        </div>
      </PortalSection>

      {/* ================= OFFLINE MODE ================= */}
      <PortalSection title="অফলাইন বিতরণ মোড">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📴 Offline Mode</div>
            <div className="text-[12px] mt-1">
              ইন্টারনেট না থাকলে টোকেন ক্যাশ হবে।
            </div>
            <div className="mt-1">
              {settings.offline.enabled ? (
                <Badge tone="green">চালু</Badge>
              ) : (
                <Badge tone="red">বন্ধ</Badge>
              )}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() =>
                patchSettings((prev) => ({
                  ...prev,
                  offline: { ...prev.offline, enabled: !prev.offline.enabled },
                }))
              }
            >
              পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🔄 Sync Conflict Policy</div>
            <div className="text-[12px] mt-1">
              সার্ভার ডেটা সর্বোচ্চ অগ্রাধিকার পাবে।
            </div>
            <Badge tone="blue">সার্ভার অগ্রাধিকার</Badge>
          </div>
        </div>
      </PortalSection>

      {/* ================= NOTIFICATIONS ================= */}
      <PortalSection title="নোটিফিকেশন ও অ্যালার্ট">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📩 SMS Notification</div>
            <div className="mt-1">
              {settings.notifications.sms ? (
                <Badge tone="green">চালু</Badge>
              ) : (
                <Badge tone="red">বন্ধ</Badge>
              )}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() =>
                patchSettings((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    sms: !prev.notifications.sms,
                  },
                }))
              }
            >
              পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">📲 App Notification</div>
            <div className="mt-1">
              {settings.notifications.app ? (
                <Badge tone="green">চালু</Badge>
              ) : (
                <Badge tone="red">বন্ধ</Badge>
              )}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() =>
                patchSettings((prev) => ({
                  ...prev,
                  notifications: {
                    ...prev.notifications,
                    app: !prev.notifications.app,
                  },
                }))
              }
            >
              পরিবর্তন
            </Button>
          </div>
        </div>
      </PortalSection>

      {/* ================= AUDIT & LOG ================= */}
      <PortalSection title="অডিট লগ ও ডেটা সংরক্ষণ">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🧾 Log Retention</div>
            <div className="text-[12px] mt-1">
              সংরক্ষণ সময়: {settings.audit.retentionYears} বছর
            </div>
            <input
              type="number"
              min={1}
              value={settings.audit.retentionYears}
              onChange={(e) =>
                patchSettings((prev) => ({
                  ...prev,
                  audit: {
                    ...prev.audit,
                    retentionYears: Number(e.target.value) || 1,
                  },
                }))
              }
              className="mt-2 w-full border rounded px-3 py-2 text-[12px]"
            />
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">🔒 Immutable Logs</div>
            <div className="text-[12px] mt-1">লগ পরিবর্তন বা মুছা যাবে না।</div>
            <Badge tone="purple">
              {settings.audit.immutable ? "সক্রিয়" : "বন্ধ"}
            </Badge>
          </div>
        </div>
      </PortalSection>

      <PortalSection title="পাসওয়ার্ড পরিবর্তন">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[13px]">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="বর্তমান পাসওয়ার্ড"
            className="border rounded px-3 py-2"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="নতুন পাসওয়ার্ড"
            className="border rounded px-3 py-2"
          />
          <Button onClick={() => void savePassword()} disabled={loading}>
            পাসওয়ার্ড আপডেট
          </Button>
        </div>
      </PortalSection>

      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => void onResetSettings()}
          disabled={loading}
        >
          ডিফল্টে রিসেট
        </Button>
        <Button onClick={() => void saveSettings()} disabled={loading}>
          সব সেটিংস সংরক্ষণ
        </Button>
      </div>
    </div>
  );
}
