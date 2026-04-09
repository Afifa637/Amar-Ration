import { useEffect, useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import {
  changeMyPassword,
  getDistributorSettings,
  updateDistributorSettings,
  updateMyProfile,
  type DistributorSettings,
  type SettingsProfile,
} from "../services/api";
import { useAuth } from "../context/useAuth";

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  label: string;
  hint: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="text-[12px] text-[#374151] font-medium block mb-1">
        {label} <span className="text-[#6b7280]">{hint}</span>
      </label>
      <input
        type={type}
        className={`w-full border rounded px-3 py-2 text-[13px] ${
          readOnly
            ? "bg-gray-100 cursor-not-allowed text-gray-500"
            : "bg-white border-blue-300 focus:ring-blue-500"
        }`}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { updateSession } = useAuth();
  const [settings, setSettings] = useState<DistributorSettings | null>(null);
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDistributorSettings();
      if (Array.isArray(data.settings)) {
        setSettings(null);
        setProfile(null);
        setError("এই পেজটি ডিস্ট্রিবিউটর সেটিংসের জন্য");
        return;
      }
      setSettings(data.settings as DistributorSettings);
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

  const saveProfile = async () => {
    if (!profile) return;
    try {
      setLoading(true);
      setError("");
      const result = await updateMyProfile({
        name: profile.name,
        phone: profile.phone,
      });
      if (result?.user) {
        setProfile((prev) => ({ ...prev, ...result.user }));
        updateSession({
          userPatch: {
            name: result.user.name,
            phone: result.user.phone,
          },
        });
      }
      setMessage("প্রোফাইল আপডেট হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "প্রোফাইল আপডেট ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!settings) return;
    try {
      setLoading(true);
      setError("");
      await updateDistributorSettings({
        offline: settings.offline,
        notifications: settings.notifications,
      } as DistributorSettings);
      setMessage("পছন্দসমূহ সংরক্ষণ হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("বর্তমান ও নতুন পাসওয়ার্ড দিন");
      return;
    }
    if (newPassword.length < 8) {
      setError("নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("নতুন পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড এক নয়");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await changeMyPassword({
        currentPassword,
        newPassword,
      });

      updateSession({
        token: result.token,
        userPatch: { mustChangePassword: false },
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "পাসওয়ার্ড পরিবর্তন ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!settings || !profile) {
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
        title="পাসওয়ার্ড পরিবর্তন"
        right={
          <Button onClick={() => void savePassword()} disabled={loading}>
            পাসওয়ার্ড আপডেট
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field
            label="বর্তমান পাসওয়ার্ড"
            hint=""
            value={currentPassword}
            onChange={setCurrentPassword}
            type="password"
          />
          <Field
            label="নতুন পাসওয়ার্ড"
            hint="(কমপক্ষে ৮ অক্ষর)"
            value={newPassword}
            onChange={setNewPassword}
            type="password"
          />
          <Field
            label="নতুন পাসওয়ার্ড নিশ্চিত করুন"
            hint=""
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
          />
        </div>
      </PortalSection>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-2">
        <h3 className="font-semibold text-gray-700 mb-3">
          অ্যাডমিন নির্ধারিত নীতি (পরিবর্তনযোগ্য নয়)
        </h3>
        <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
          <p>
            অনুমোদন:{" "}
            {settings.policy.adminApprovalRequired
              ? "অ্যাডমিন অনুমোদন প্রয়োজন"
              : "স্বয়ংক্রিয়"}
          </p>
          <p>কর্তৃত্বের মেয়াদ: {settings.policy.authorityMonths} মাস</p>
          <p>ওজন সহনশীলতা: {settings.distribution.weightThresholdKg} কেজি</p>
          <p>
            বিভাগ ক/খ/গ রেশন: {settings.allocation.A}/{settings.allocation.B}/
            {settings.allocation.C} কেজি
          </p>
          <p>
            জালিয়াতি সীমা: {settings.fraud.autoBlacklistMismatchCount} বার
            মিসম্যাচে স্বয়ংক্রিয় বাতিল
          </p>
        </div>
      </div>

      <PortalSection
        title="ব্যক্তিগত তথ্য"
        right={
          <Button onClick={() => void saveProfile()} disabled={loading}>
            প্রোফাইল সংরক্ষণ
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            label="পূর্ণ নাম"
            hint="(পরিবর্তনযোগ্য)"
            value={profile.name || ""}
            onChange={(v) =>
              setProfile((p) => ({ ...(p || { name: "" }), name: v }))
            }
          />
          <Field
            label="ফোন নম্বর"
            hint="(যোগাযোগের জন্য)"
            value={profile.phone || ""}
            onChange={(v) =>
              setProfile((p) => ({ ...(p || { name: "" }), phone: v }))
            }
          />
          <Field
            label="ইমেইল"
            hint="(লগইনের জন্য — অ্যাডমিন নিয়ন্ত্রিত)"
            value={profile.email || ""}
            readOnly
          />
          <Field
            label="ওয়ার্ড নম্বর"
            hint="(অ্যাডমিন নির্ধারিত)"
            value={profile.wardNo || ""}
            readOnly
          />
          <Field
            label="অফিসের ঠিকানা"
            hint=""
            value={profile.officeAddress || ""}
            readOnly
          />
          <Field
            label="বিভাগ"
            hint=""
            value={profile.division || ""}
            readOnly
          />
          <Field label="জেলা" hint="" value={profile.district || ""} readOnly />
          <Field
            label="উপজেলা"
            hint=""
            value={profile.upazila || ""}
            readOnly
          />
          <Field
            label="ইউনিয়ন"
            hint=""
            value={profile.unionName || ""}
            readOnly
          />
        </div>
      </PortalSection>

      <PortalSection title="ডিস্ট্রিবিউটর পছন্দ (পরিবর্তনযোগ্য)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">অফলাইন মোড</div>
            <div className="text-[12px] mt-1">
              {settings.offline.enabled ? "চালু" : "বন্ধ"}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        offline: {
                          ...prev.offline,
                          enabled: !prev.offline.enabled,
                        },
                      }
                    : prev,
                )
              }
            >
              পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">SMS নোটিফিকেশন</div>
            <div className="text-[12px] mt-1">
              {settings.notifications.sms ? "চালু" : "বন্ধ"}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          sms: !prev.notifications.sms,
                        },
                      }
                    : prev,
                )
              }
            >
              পরিবর্তন
            </Button>
          </div>

          <div className="border p-3 bg-[#fbfdff]">
            <div className="font-semibold">অ্যাপ নোটিফিকেশন</div>
            <div className="text-[12px] mt-1">
              {settings.notifications.app ? "চালু" : "বন্ধ"}
            </div>
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          app: !prev.notifications.app,
                        },
                      }
                    : prev,
                )
              }
            >
              পরিবর্তন
            </Button>
          </div>
        </div>
      </PortalSection>

      <div className="flex justify-end">
        <Button onClick={() => void savePreferences()} disabled={loading}>
          পছন্দসমূহ সংরক্ষণ
        </Button>
      </div>
    </div>
  );
}
