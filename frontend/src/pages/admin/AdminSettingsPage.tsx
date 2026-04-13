import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import Button from "../../components/ui/Button";
import {
  disableAdmin2FA,
  getDistributorSettings,
  resetAdmin2FASetup,
  setupAdmin2FA,
  updateDistributorSettings,
  verifyAdmin2FA,
  type DistributorSettings,
} from "../../services/api";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<DistributorSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [twoFASecret, setTwoFASecret] = useState("");
  const [twoFAQrDataUrl, setTwoFAQrDataUrl] = useState("");
  const [twoFAToken, setTwoFAToken] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableToken, setDisableToken] = useState("");

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
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const data = await setupAdmin2FA();
      setTwoFASecret(data.secret || "");
      setTwoFAQrDataUrl(data.qrDataUrl || "");
      setMessage("২FA setup শুরু হয়েছে। অ্যাপ দিয়ে QR স্ক্যান করে কোড দিন।");
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
      const result = await verifyAdmin2FA(twoFAToken.trim());
      const backupCodes = result?.data?.backupCodes || [];
      setMessage(
        backupCodes.length
          ? `2FA সক্রিয় হয়েছে। Backup codes: ${backupCodes.join(" , ")}`
          : "2FA সক্রিয় হয়েছে",
      );
      setTwoFAToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA verify ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onResetSetup2FA = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const data = await resetAdmin2FASetup();
      setTwoFASecret(data.secret || "");
      setTwoFAQrDataUrl(data.qrDataUrl || "");
      setTwoFAToken("");
      setMessage(
        "Pending 2FA setup secret reset হয়েছে। নতুন QR স্ক্যান করুন।",
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
      setTwoFAQrDataUrl("");
      setMessage("2FA বন্ধ করা হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA disable ব্যর্থ");
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
              অ্যাডমিন লগইনে TOTP 2FA চালু/বন্ধ করুন
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              <Button onClick={() => void onSetup2FA()} disabled={loading}>
                2FA Setup শুরু
              </Button>
              <Button
                variant="secondary"
                onClick={() => void onResetSetup2FA()}
                disabled={loading}
              >
                Pending Setup Reset
              </Button>
            </div>

            {twoFAQrDataUrl && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start mb-3">
                <div className="border rounded p-2 bg-white inline-flex items-center justify-center">
                  <img
                    src={twoFAQrDataUrl}
                    alt="2FA QR"
                    className="w-44 h-44"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-[12px] text-gray-600 break-all">
                    Secret: <span className="font-mono">{twoFASecret}</span>
                  </div>
                  <input
                    type="text"
                    value={twoFAToken}
                    onChange={(e) =>
                      setTwoFAToken(e.target.value.replace(/\s/g, ""))
                    }
                    className="w-full border rounded px-3 py-2"
                    placeholder="TOTP কোড দিন"
                  />
                  <Button onClick={() => void onVerify2FA()} disabled={loading}>
                    2FA Verify করে চালু করুন
                  </Button>
                </div>
              </div>
            )}

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
                placeholder="Current TOTP"
              />
              <Button
                variant="danger"
                onClick={() => void onDisable2FA()}
                disabled={loading}
              >
                2FA Disable
              </Button>
            </div>
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
