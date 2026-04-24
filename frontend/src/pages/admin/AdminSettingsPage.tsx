import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import Button from "../../components/ui/Button";
import {
  disableAdmin2FA,
  getAdmin2FAStatus,
  getDistributorSettings,
  resetAdmin2FASetup,
  setupAdmin2FA,
  updateDistributorSettings,
  verifyAdmin2FA,
  type Admin2FAStatus,
  type DistributorSettings,
} from "../../services/api";
import { useAuth } from "../../context/useAuth";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("bn-BD");
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<DistributorSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [twoFAStatus, setTwoFAStatus] = useState<Admin2FAStatus>({
    enabled: false,
    setupPending: false,
    pendingSince: null,
    secret: null,
  });
  const [twoFASecret, setTwoFASecret] = useState("");
  const [twoFAToken, setTwoFAToken] = useState("");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableToken, setDisableToken] = useState("");
  const [emergencyPassword, setEmergencyPassword] = useState("");
  const [emergencyConfirmText, setEmergencyConfirmText] = useState("");

  const load2FAStatus = async () => {
    try {
      const status = await getAdmin2FAStatus();
      setTwoFAStatus(status);
      setTwoFASecret(status.secret || "");
    } catch {
      // keep previous state
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDistributorSettings();
      if (!Array.isArray(data.settings)) {
        setSettings(data.settings as DistributorSettings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেটিংস লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void load2FAStatus();
  }, []);

  const save = async () => {
    if (!settings) return;
    try {
      setLoading(true);
      setError("");
      await updateDistributorSettings(settings);
      setMessage("অ্যাডমিন সেটিংস সংরক্ষণ হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onSetup2FA = async () => {
    if (twoFAStatus.enabled) {
      setError("2FA ইতোমধ্যে চালু আছে");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const isRecoveryPath = !!twoFAStatus.mismatch;
      if (!isRecoveryPath && !setupPassword.trim()) {
        setError("2FA সেটআপের আগে বর্তমান পাসওয়ার্ড দিন");
        return;
      }
      const data = await setupAdmin2FA(
        isRecoveryPath
          ? {}
          : {
              password: setupPassword,
            },
      );
      setTwoFASecret(data.secret || "");
      setTwoFAToken("");
      setSetupPassword("");
      await load2FAStatus();
      setMessage(
        "২FA setup pending আছে। ম্যানুয়াল secret অ্যাপে যোগ করে কোড যাচাই করুন।",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA setup ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onVerify2FA = async () => {
    if (!twoFAToken.trim()) {
      setError("২FA কোড দিন");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const latestStatus = await getAdmin2FAStatus();
      setTwoFAStatus(latestStatus);
      setTwoFASecret(latestStatus.secret || "");

      if (!latestStatus.enabled && !latestStatus.setupPending) {
        setError(
          "2FA setup তথ্য সিঙ্ক হয়নি। বর্তমান পাসওয়ার্ড দিয়ে আবার setup শুরু করুন।",
        );
        return;
      }

      const result = await verifyAdmin2FA(twoFAToken.trim());
      const backupCodes = result?.data?.backupCodes || [];
      setMessage(
        backupCodes.length
          ? `2FA সক্রিয় হয়েছে। Backup codes: ${backupCodes.join(" , ")}`
          : "2FA সক্রিয় হয়েছে",
      );
      setTwoFAToken("");
      setTwoFASecret("");
      await load2FAStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "2FA verify ব্যর্থ";
      if (msg.includes("2FA not set up")) {
        await load2FAStatus();
        setError(
          "2FA secret পাওয়া যায়নি। বর্তমান পাসওয়ার্ড দিয়ে setup পুনরায় চালু করুন, তারপর নতুন OTP দিয়ে verify করুন।",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onResetSetup2FA = async () => {
    if (resetConfirmText.trim() !== "CHANGE_2FA_SECRET") {
      setError("নতুন secret নেওয়ার জন্য CHANGE_2FA_SECRET লিখুন");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const data = await resetAdmin2FASetup();
      setTwoFASecret(data.secret || "");
      setTwoFAToken("");
      setResetConfirmText("");
      await load2FAStatus();
      setMessage(
        "Pending 2FA setup secret reset হয়েছে। নতুন secret অ্যাপে যোগ করুন।",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA setup reset ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onDisable2FA = async () => {
    if (!disablePassword || !disableToken) {
      setError("2FA বন্ধ করতে পাসওয়ার্ড ও TOTP কোড দিন");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await disableAdmin2FA({
        password: disablePassword,
        totpToken: disableToken,
      });
      setDisablePassword("");
      setDisableToken("");
      setTwoFASecret("");
      setTwoFAToken("");
      await load2FAStatus();
      setMessage("2FA বন্ধ করা হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA disable ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onEmergencyDisable2FA = async () => {
    if (!emergencyPassword.trim()) {
      setError("জরুরি বন্ধ করতে বর্তমান পাসওয়ার্ড দিন");
      return;
    }
    if (emergencyConfirmText.trim() !== "DISABLE_2FA_EMERGENCY") {
      setError("নিশ্চিত করতে DISABLE_2FA_EMERGENCY লিখুন");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await disableAdmin2FA({
        password: emergencyPassword,
        emergencyConfirm: "DISABLE_2FA_EMERGENCY",
      });
      setEmergencyPassword("");
      setEmergencyConfirmText("");
      setDisablePassword("");
      setDisableToken("");
      setTwoFASecret("");
      setTwoFAToken("");
      await load2FAStatus();
      setMessage("2FA জরুরি ভিত্তিতে বন্ধ করা হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "জরুরি disable ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return <div className="text-[12px] text-[#6b7280]">লোড হচ্ছে...</div>;
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

      <SectionCard title="নীতি ও প্রশাসনিক নিয়ন্ত্রণ (অ্যাডমিন)">
        <div className="space-y-3 text-[13px]">
          <div className="border rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">Admin 2FA Security</div>
            <p className="text-sm text-gray-400 mt-0.5 mb-3">
              অ্যাডমিন লগইনে OTP বাধ্যতামূলক রাখার জন্য নিরাপদ 2FA সেটিংস
            </p>

            <div className="mb-3 rounded border px-3 py-2 text-[12px] bg-white leading-5">
              {twoFAStatus.enabled
                ? "অবস্থা: 2FA সক্রিয় (লগইনের পর OTP ছাড়া ড্যাশবোর্ডে ঢোকা যাবে না)"
                : twoFAStatus.setupPending
                  ? `অবস্থা: setup pending${twoFAStatus.pendingSince ? ` (শুরু: ${new Date(twoFAStatus.pendingSince).toLocaleString("bn-BD")})` : ""}`
                  : "অবস্থা: 2FA সক্রিয় নয়"}
            </div>

            {(twoFAStatus.mismatch || user?.twoFactorMismatch) && (
              <div className="mb-4 p-4 bg-red-50 border-2 border-red-400 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-red-500 text-xl">⚠️</span>
                  <div>
                    <p className="font-bold text-red-800 text-sm">
                      2FA সিক্রেট পরিবর্তন সনাক্ত হয়েছে
                    </p>
                    <p className="text-red-700 text-xs mt-1">
                      আপনার 2FA সিক্রেট পরিবর্তিত হয়েছে এবং স্বয়ংক্রিয়ভাবে
                      বন্ধ করা হয়েছে। সুরক্ষার জন্য নিচে থেকে পুনরায় 2FA
                      সক্রিয় করুন।
                    </p>
                    {twoFAStatus.mismatchDetectedAt && (
                      <p className="text-red-600 text-xs mt-1">
                        সনাক্তের সময়:{" "}
                        {formatDate(twoFAStatus.mismatchDetectedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!twoFAStatus.enabled && !twoFAStatus.setupPending && (
              <div className="mb-3">
                {!twoFAStatus.mismatch && (
                  <div className="mb-2">
                    <label className="block text-[12px] mb-1 font-medium text-[#374151]">
                      বর্তমান পাসওয়ার্ড (নতুন secret তৈরির জন্য)
                    </label>
                    <input
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      placeholder="বর্তমান পাসওয়ার্ড"
                    />
                  </div>
                )}
                <Button onClick={() => void onSetup2FA()} disabled={loading}>
                  2FA Setup শুরু করুন
                </Button>
              </div>
            )}

            {twoFAStatus.setupPending && (
              <div className="mb-3 rounded border p-3 bg-white space-y-2">
                <div className="text-[12px] text-gray-600">
                  QR বাদ দেয়া হয়েছে। Authenticator app-এ নিচের secret manual
                  ভাবে যোগ করুন। এই secret verify না করা পর্যন্ত একই থাকবে।
                </div>
                <div className="text-[12px] text-gray-700 break-all">
                  Secret: <span className="font-mono">{twoFASecret}</span>
                </div>

                {!twoFAStatus.mismatch && (
                  <div className="space-y-2 border rounded p-2 bg-[#f8fafc]">
                    <label className="block text-[12px] font-medium text-[#374151]">
                      বর্তমান পাসওয়ার্ড (setup পুনরায় সিঙ্ক করার জন্য)
                    </label>
                    <input
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      placeholder="বর্তমান পাসওয়ার্ড"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => void onSetup2FA()}
                      disabled={loading}
                    >
                      Setup পুনরায় সিঙ্ক করুন
                    </Button>
                  </div>
                )}

                <input
                  type="text"
                  value={twoFAToken}
                  onChange={(e) =>
                    setTwoFAToken(e.target.value.replace(/\s/g, ""))
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="Authenticator app থেকে 6-digit কোড দিন"
                />
                <Button onClick={() => void onVerify2FA()} disabled={loading}>
                  2FA Verify করে চালু করুন
                </Button>

                <div className="border-t pt-3 mt-2 space-y-2">
                  <div className="text-[12px] text-[#b45309]">
                    Secret পরিবর্তন করতে চাইলে নিশ্চিতকরণ লিখুন:
                    <span className="font-mono"> CHANGE_2FA_SECRET</span>
                  </div>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    placeholder="CHANGE_2FA_SECRET লিখুন"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void onResetSetup2FA()}
                    disabled={loading}
                  >
                    নতুন Secret অনুরোধ করুন
                  </Button>
                </div>
              </div>
            )}

            {twoFAStatus.enabled && (
              <div className="border-t pt-3 mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Current password"
                />
                <input
                  type="text"
                  value={disableToken}
                  onChange={(e) =>
                    setDisableToken(e.target.value.replace(/\s/g, ""))
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="Current OTP code"
                />
                <Button
                  variant="danger"
                  onClick={() => void onDisable2FA()}
                  disabled={loading}
                >
                  2FA Disable
                </Button>
                <div className="md:col-span-3 text-[12px] text-[#6b7280]">
                  OTP না পেলে উপরের জরুরি পদ্ধতি ব্যবহার করুন।
                </div>
              </div>
            )}

            {twoFAStatus.mismatch && (
              <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 space-y-2">
                <div className="font-semibold text-red-800 text-sm">
                  জরুরি 2FA বন্ধ করুন
                </div>
                <p className="text-xs text-red-700">
                  যদি আপনার Authenticator App কাজ না করে, শুধু পাসওয়ার্ড দিয়ে
                  2FA বন্ধ করুন।
                </p>
                <input
                  type="password"
                  value={emergencyPassword}
                  onChange={(e) => setEmergencyPassword(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="বর্তমান পাসওয়ার্ড"
                />
                <input
                  type="text"
                  value={emergencyConfirmText}
                  onChange={(e) => setEmergencyConfirmText(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="নিশ্চিত করতে DISABLE_2FA_EMERGENCY লিখুন"
                />
                <Button
                  variant="danger"
                  onClick={() => void onEmergencyDisable2FA()}
                  disabled={loading}
                >
                  জরুরি ভিত্তিতে বন্ধ করুন
                </Button>
              </div>
            )}
          </div>

          <div className="border rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">নীতি</div>
            <p className="text-sm text-gray-400 mt-0.5 mb-3">
              অ্যাডমিন অনুমোদন ও কর্তৃত্বের মেয়াদ সংক্রান্ত নিয়ম
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={settings.policy.adminApprovalRequired ? "yes" : "no"}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          policy: {
                            ...prev.policy,
                            adminApprovalRequired: e.target.value === "yes",
                          },
                        }
                      : prev,
                  )
                }
                className="w-full border rounded px-3 py-2 bg-white"
              >
                <option value="yes">প্রয়োজন</option>
                <option value="no">প্রয়োজন নেই</option>
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={settings.policy.authorityMonths}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            policy: {
                              ...prev.policy,
                              authorityMonths: Math.max(
                                1,
                                Number(e.target.value) || 1,
                              ),
                            },
                          }
                        : prev,
                    )
                  }
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-sm text-gray-500">মাস</span>
              </div>
            </div>
          </div>

          <div className="border rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">বিতরণ</div>
            <p className="text-sm text-gray-400 mt-0.5 mb-3">
              ওজন যাচাই ও টোকেন নিয়ন্ত্রণ
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={settings.distribution.weightThresholdKg}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            distribution: {
                              ...prev.distribution,
                              weightThresholdKg: Math.max(
                                1,
                                Number(e.target.value) || 1,
                              ),
                            },
                          }
                        : prev,
                    )
                  }
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-sm text-gray-500">কেজি</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={Math.round(
                    Number(
                      settings.distribution.weightThresholdPercent || 0.05,
                    ) * 100,
                  )}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            distribution: {
                              ...prev.distribution,
                              weightThresholdPercent: Math.max(
                                0.01,
                                (Number(e.target.value) || 5) / 100,
                              ),
                            },
                          }
                        : prev,
                    )
                  }
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={settings.distribution.tokenPerConsumerPerDay}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            distribution: {
                              ...prev.distribution,
                              tokenPerConsumerPerDay: Math.max(
                                1,
                                Number(e.target.value) || 1,
                              ),
                            },
                          }
                        : prev,
                    )
                  }
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-sm text-gray-500">টোকেন/দিন</span>
              </div>
            </div>
          </div>

          <div className="border rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">QR কোড</div>
            <p className="text-sm text-gray-400 mt-0.5 mb-3">
              QR মেয়াদ ও নবায়ন নিয়ম
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={settings.qr.expiryCycleDays}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          qr: {
                            ...prev.qr,
                            expiryCycleDays: Math.max(
                              1,
                              Number(e.target.value) || 1,
                            ),
                          },
                        }
                      : prev,
                  )
                }
                className="w-full border rounded px-3 py-2"
              />
              <span className="text-sm text-gray-500">দিন</span>
            </div>
          </div>

          <div className="border rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">রেশন বরাদ্দ</div>
            <p className="text-sm text-gray-400 mt-0.5 mb-3">
              বিভাগ অনুযায়ী প্রতিটি পরিবারের দৈনিক বরাদ্দ
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["A", "B", "C"] as const).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={settings.allocation[key]}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              allocation: {
                                ...prev.allocation,
                                [key]: Math.max(0, Number(e.target.value) || 0),
                              },
                            }
                          : prev,
                      )
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                  <span className="text-sm text-gray-500">কেজি</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">জালিয়াতি প্রতিরোধ</div>
            <p className="text-sm text-gray-400 mt-0.5 mb-3">
              স্বয়ংক্রিয় বাতিল ও ব্লকিং নিয়ম
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={settings.fraud.autoBlacklistMismatchCount}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            fraud: {
                              ...prev.fraud,
                              autoBlacklistMismatchCount: Math.max(
                                1,
                                Number(e.target.value) || 1,
                              ),
                            },
                          }
                        : prev,
                    )
                  }
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-sm text-gray-500">বার</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={settings.fraud.temporaryBlockDays}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            fraud: {
                              ...prev.fraud,
                              temporaryBlockDays: Math.max(
                                1,
                                Number(e.target.value) || 1,
                              ),
                            },
                          }
                        : prev,
                    )
                  }
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-sm text-gray-500">দিন</span>
              </div>
            </div>
          </div>

          <div className="border rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">অডিট</div>
            <p className="text-sm text-gray-400 mt-0.5 mb-3">
              লগ সংরক্ষণ ও অপরিবর্তনীয়তা নিশ্চিতকরণ
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={settings.audit.retentionYears}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          audit: {
                            ...prev.audit,
                            retentionYears: Math.max(
                              1,
                              Number(e.target.value) || 1,
                            ),
                          },
                        }
                      : prev,
                  )
                }
                className="w-full border rounded px-3 py-2"
              />
              <span className="text-sm text-gray-500">বছর</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={loading}>
          অ্যাডমিন সেটিংস সংরক্ষণ
        </Button>
      </div>
    </div>
  );
}
