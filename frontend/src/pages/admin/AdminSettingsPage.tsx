import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import Button from "../../components/ui/Button";
import {
  getDistributorSettings,
  updateDistributorSettings,
  type DistributorSettings,
} from "../../services/api";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<DistributorSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
            <div className="font-semibold">স্মার্ট স্কেল পণ্য ওজন</div>
            <p className="text-sm text-gray-400 mt-0.5 mb-3">
              Smart ওজন যন্ত্রের P1, P2, P3 সিলেকশনের জন্য ডিফল্ট টার্গেট
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([
                ["p1Kg", "P1 / Rice"],
                ["p2Kg", "P2 / Lentil"],
                ["p3Kg", "P3 / Onion"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">{label}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={settings.productTargets[key]}
                      onChange={(e) =>
                        setSettings((prev) =>
                          prev
                            ? {
                                ...prev,
                                productTargets: {
                                  ...prev.productTargets,
                                  [key]: Math.max(
                                    0.01,
                                    Number(e.target.value) || 0.01,
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
