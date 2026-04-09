import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import {
  createBlacklistEntry,
  deactivateBlacklistEntry,
  getAdminAuditDetail,
  getAdminAuditRequests,
  getAuditLogs,
  getBlacklistEntries,
  type MonitoringBlacklistEntry,
  requestAuditReport,
  reviewAuditReportRequest,
  type AuditLogEntry,
  type AuditReportRequest,
} from "../../services/api";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [blacklistCount, setBlacklistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<{
    log: AuditLogEntry;
    consumer?: {
      name?: string;
      consumerCode?: string;
      nidLast4?: string;
      nidFull?: string;
      fatherNidFull?: string;
      motherNidFull?: string;
      status?: string;
      category?: string;
      blacklistStatus?: string;
      division?: string;
      district?: string;
      upazila?: string;
      unionName?: string;
      ward?: string;
      createdByDistributor?: { name?: string; phone?: string; email?: string };
    } | null;
  } | null>(null);
  const [requests, setRequests] = useState<AuditReportRequest[]>([]);
  const [blacklist, setBlacklist] = useState<MonitoringBlacklistEntry[]>([]);
  const [note, setNote] = useState("");
  const [requesting, setRequesting] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<AuditReportRequest | null>(null);
  const [openBlacklistModal, setOpenBlacklistModal] = useState(false);
  const [blacklistForm, setBlacklistForm] = useState({
    targetType: "Consumer" as "Consumer" | "Distributor",
    targetRefId: "",
    reason: "",
    blockType: "Temporary" as "Temporary" | "Permanent",
    durationDays: 7,
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [auditData, blacklistData, requestData] = await Promise.all([
        getAuditLogs({ page: 1, limit: 50, sortOrder: "desc" }),
        getBlacklistEntries({ limit: 100 }),
        getAdminAuditRequests(),
      ]);
      setLogs(auditData.logs || []);
      setBlacklistCount(blacklistData.entries?.length || 0);
      setBlacklist(blacklistData.entries || []);
      setRequests(requestData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "অডিট ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const auditStats = useMemo(() => {
    const alerts = logs.filter((log) =>
      ["Warning", "Critical"].includes(log.severity),
    ).length;
    const mismatches = logs.filter((log) =>
      log.action.includes("MISMATCH"),
    ).length;
    const stockAnomalies = logs.filter((log) =>
      log.action.toLowerCase().includes("stock"),
    ).length;
    return { alerts, mismatches, stockAnomalies };
  }, [logs]);

  const severityLabel = (severity: AuditLogEntry["severity"]) => {
    switch (severity) {
      case "Critical":
        return "জরুরি";
      case "Warning":
        return "সতর্কতা";
      default:
        return "তথ্য";
    }
  };

  const openDetail = async (log: AuditLogEntry) => {
    try {
      setLoading(true);
      const data = await getAdminAuditDetail(log._id);
      setSelected({ log: data.log, consumer: data.consumer || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডিটেইল লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onRequestReport = async (log: AuditLogEntry) => {
    if (!log.actorUserId) return;
    try {
      setRequesting(log._id);
      await requestAuditReport({
        distributorUserId: log.actorUserId,
        auditLogId: log._id,
        note: note.trim() || undefined,
      });
      setNote("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিকোয়েস্ট ব্যর্থ");
    } finally {
      setRequesting(null);
    }
  };

  const onReviewRequest = async (
    decision: "Approved" | "Rejected" | "Suspended",
  ) => {
    if (!reviewing) return;
    try {
      setLoading(true);
      await reviewAuditReportRequest(reviewing._id, decision);
      setReviewing(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিভিউ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (entryId: string) => {
    if (!window.confirm("এই ব্ল্যাকলিস্ট এন্ট্রি নিষ্ক্রিয় করতে চান?")) return;
    try {
      setLoading(true);
      await deactivateBlacklistEntry(entryId);
      setMessage("ব্ল্যাকলিস্ট এন্ট্রি নিষ্ক্রিয় করা হয়েছে");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "আনব্লক ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBlacklist = async () => {
    if (!blacklistForm.targetRefId.trim() || !blacklistForm.reason.trim()) {
      setError("টার্গেট আইডি এবং কারণ বাধ্যতামূলক");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const expiresAt =
        blacklistForm.blockType === "Temporary"
          ? new Date(
              Date.now() + Number(blacklistForm.durationDays || 7) * 86400000,
            ).toISOString()
          : undefined;

      await createBlacklistEntry({
        targetType: blacklistForm.targetType,
        targetRefId: blacklistForm.targetRefId.trim(),
        reason: blacklistForm.reason.trim(),
        blockType: blacklistForm.blockType,
        active: true,
        expiresAt,
      });

      setOpenBlacklistModal(false);
      setBlacklistForm({
        targetType: "Consumer",
        targetRefId: "",
        reason: "",
        blockType: "Temporary",
        durationDays: 7,
      });
      setMessage("ব্ল্যাকলিস্ট এন্ট্রি তৈরি হয়েছে");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ব্ল্যাকলিস্ট তৈরি ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> অডিট, ফ্রড ও ব্ল্যাকলিস্ট
      </div>

      <SectionCard title="অডিট সিগন্যাল সারাংশ">
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-3 text-[12px] bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] px-3 py-2 rounded">
            {message}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["খোলা এলার্ট", String(auditStats.alerts)],
            ["ওজন মিসম্যাচ", String(auditStats.mismatches)],
            ["স্টক অস্বাভাবিকতা", String(auditStats.stockAnomalies)],
            ["ব্ল্যাকলিস্ট সম্ভাবনা", String(blacklistCount)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]"
            >
              <div className="text-sm text-[#6b7280]">{label}</div>
              <div className="text-2xl font-bold text-[#1f2d3d] mt-1">
                {value}
              </div>
            </div>
          ))}
        </div>
        {loading && (
          <div className="text-[12px] text-[#6b7280] mt-2">লোড হচ্ছে...</div>
        )}
      </SectionCard>

      <SectionCard title="অডিট লগ (অপরিবর্তনযোগ্য)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {["সময়", "ইভেন্ট", "অ্যাক্টর", "অবস্থা", "অ্যাকশন"].map(
                  (head) => (
                    <th key={head} className="p-2 border border-[#d7dde6]">
                      {head}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{log.action}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {log.actorType}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {severityLabel(log.severity)}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => void openDetail(log)}
                      >
                        বিস্তারিত দেখুন
                      </Button>
                      {log.actorType === "Distributor" &&
                        ["Warning", "Critical"].includes(log.severity) && (
                          <Button
                            onClick={() => void onRequestReport(log)}
                            disabled={requesting === log._id}
                          >
                            অডিট রিপোর্ট চাই
                          </Button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="অডিট রিপোর্ট রিকোয়েস্ট">
        <div className="mb-3">
          <div className="text-[12px] text-[#6b7280] mb-1">নোট</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border rounded px-3 py-2 text-[12px]"
            placeholder="রিপোর্টের জন্য নির্দেশনা লিখুন"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "স্ট্যাটাস",
                  "ডিস্ট্রিবিউটর",
                  "ডেডলাইন",
                  "সময়",
                  "রিপোর্ট",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((item) => (
                <tr key={item._id} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">{item.status}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {typeof item.distributorUserId === "string"
                      ? item.distributorUserId
                      : item.distributorUserId?.name || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {item.dueAt
                      ? new Date(item.dueAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {item.reportText ? (
                      <Button
                        variant="secondary"
                        onClick={() => setReviewing(item)}
                      >
                        রিপোর্ট দেখুন
                      </Button>
                    ) : (
                      "অপেক্ষমান"
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-[#6b7280]">
                    কোনো রিকোয়েস্ট নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="ব্ল্যাকলিস্ট নীতি">
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setOpenBlacklistModal(true)}>
            নতুন ব্ল্যাকলিস্ট
          </Button>
        </div>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "টার্গেট টাইপ",
                  "আইডি",
                  "কারণ",
                  "ব্লক টাইপ",
                  "মেয়াদ শেষ",
                  "স্ট্যাটাস",
                  "অ্যাকশন",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blacklist.map((entry) => (
                <tr key={entry._id} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">
                    {entry.targetType}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {entry.targetRefId}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {entry.reason}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {entry.blockType}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {entry.expiresAt
                      ? new Date(entry.expiresAt).toLocaleDateString("bn-BD")
                      : "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {entry.active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {entry.active ? (
                      <Button
                        variant="secondary"
                        onClick={() => void handleUnblock(entry._id)}
                      >
                        🔓 আনব্লক
                      </Button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="text-[12px] px-2 py-1 rounded bg-gray-200 text-gray-500"
                      >
                        ✓ নিষ্ক্রিয়
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {blacklist.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-[#6b7280]">
                    ব্ল্যাকলিস্ট ডেটা নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• ফ্রড প্রমাণিত হলে সাময়িক ব্লক করা যাবে।</li>
          <li>• বারবার ব্যর্থতায় স্থায়ী ব্ল্যাকলিস্ট হতে পারে।</li>
          <li>• ব্ল্যাকলিস্টে কারণ ও অনুমোদনকারী অ্যাডমিন আবশ্যক।</li>
          <li>• ব্ল্যাকলিস্টেড সত্তা টোকেন ইস্যু/বিতরণ করতে পারবে না।</li>
        </ul>
      </SectionCard>

      <Modal
        open={!!selected}
        title="অডিট ডিটেইল"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-2 text-[13px]">
            <div>
              <strong>ইভেন্ট:</strong> {selected.log.action}
            </div>
            <div>
              <strong>গুরুত্ব:</strong> {selected.log.severity}
            </div>
            <div>
              <strong>সময়:</strong>{" "}
              {new Date(selected.log.createdAt).toLocaleString()}
            </div>
            {selected.consumer ? (
              <div className="border rounded p-3 space-y-1 bg-[#f8fafc]">
                <div>
                  <strong>নাম:</strong> {selected.consumer.name}
                </div>
                <div>
                  <strong>কোড:</strong> {selected.consumer.consumerCode}
                </div>
                <div>
                  <strong>NID:</strong> ****{selected.consumer.nidLast4}
                </div>
                <div>
                  <strong>স্ট্যাটাস:</strong> {selected.consumer.status}
                </div>
                <div>
                  <strong>ক্যাটাগরি:</strong> {selected.consumer.category}
                </div>
                <div>
                  <strong>পূর্ণ NID:</strong> {selected.consumer.nidFull || "—"}
                </div>
                <div>
                  <strong>পিতার NID:</strong>{" "}
                  {selected.consumer.fatherNidFull || "—"}
                </div>
                <div>
                  <strong>মাতার NID:</strong>{" "}
                  {selected.consumer.motherNidFull || "—"}
                </div>
                <div>
                  <strong>ব্ল্যাকলিস্ট:</strong>{" "}
                  {selected.consumer.blacklistStatus || "None"}
                </div>
                <div>
                  <strong>অবস্থান:</strong>{" "}
                  {[
                    selected.consumer.division,
                    selected.consumer.district,
                    selected.consumer.upazila,
                    selected.consumer.unionName,
                    selected.consumer.ward,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </div>
                <div>
                  <strong>ডিস্ট্রিবিউটর:</strong>{" "}
                  {selected.consumer.createdByDistributor?.name || "—"}
                </div>
                <div>
                  <strong>ডিস্ট্রিবিউটর ফোন:</strong>{" "}
                  {selected.consumer.createdByDistributor?.phone || "—"}
                </div>
                <div>
                  <strong>ডিস্ট্রিবিউটর ইমেইল:</strong>{" "}
                  {selected.consumer.createdByDistributor?.email || "—"}
                </div>
              </div>
            ) : (
              <div className="text-[#6b7280]">কনজিউমার ডিটেইল নেই</div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!reviewing}
        title="অডিট রিপোর্ট রিভিউ"
        onClose={() => setReviewing(null)}
      >
        {reviewing && (
          <div className="space-y-2 text-[13px]">
            <div>
              <strong>ডিস্ট্রিবিউটর:</strong>{" "}
              {typeof reviewing.distributorUserId === "string"
                ? reviewing.distributorUserId
                : reviewing.distributorUserId?.name || "—"}
            </div>
            <div>
              <strong>নোট:</strong> {reviewing.note || "—"}
            </div>
            <div className="border rounded p-3 bg-[#f8fafc] whitespace-pre-wrap">
              {reviewing.reportText || "রিপোর্ট নেই"}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => void onReviewRequest("Approved")}
                disabled={loading}
              >
                অনুমোদন করুন
              </Button>
              <Button
                onClick={() => void onReviewRequest("Suspended")}
                disabled={loading}
              >
                স্থগিত করুন
              </Button>
              <Button
                variant="danger"
                onClick={() => void onReviewRequest("Rejected")}
                disabled={loading}
              >
                বাতিল করুন
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openBlacklistModal}
        title="নতুন ব্ল্যাকলিস্ট এন্ট্রি"
        onClose={() => setOpenBlacklistModal(false)}
      >
        <div className="space-y-3 text-[13px]">
          <div>
            <div className="text-[12px] mb-1 font-medium">টার্গেট টাইপ</div>
            <select
              className="w-full border rounded px-3 py-2"
              value={blacklistForm.targetType}
              onChange={(e) =>
                setBlacklistForm((prev) => ({
                  ...prev,
                  targetType: e.target.value as "Consumer" | "Distributor",
                }))
              }
            >
              <option value="Consumer">Consumer</option>
              <option value="Distributor">Distributor</option>
            </select>
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">টার্গেট আইডি</div>
            <input
              className="w-full border rounded px-3 py-2"
              value={blacklistForm.targetRefId}
              onChange={(e) =>
                setBlacklistForm((prev) => ({
                  ...prev,
                  targetRefId: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">কারণ</div>
            <input
              className="w-full border rounded px-3 py-2"
              value={blacklistForm.reason}
              onChange={(e) =>
                setBlacklistForm((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">ব্লক টাইপ</div>
            <select
              className="w-full border rounded px-3 py-2"
              value={blacklistForm.blockType}
              onChange={(e) =>
                setBlacklistForm((prev) => ({
                  ...prev,
                  blockType: e.target.value as "Temporary" | "Permanent",
                }))
              }
            >
              <option value="Temporary">Temporary</option>
              <option value="Permanent">Permanent</option>
            </select>
          </div>
          {blacklistForm.blockType === "Temporary" && (
            <div>
              <div className="text-[12px] mb-1 font-medium">মেয়াদ (দিন)</div>
              <input
                type="number"
                min={1}
                className="w-full border rounded px-3 py-2"
                value={blacklistForm.durationDays}
                onChange={(e) =>
                  setBlacklistForm((prev) => ({
                    ...prev,
                    durationDays: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenBlacklistModal(false)}
            >
              বাতিল
            </Button>
            <Button
              onClick={() => void handleCreateBlacklist()}
              disabled={loading}
            >
              তৈরি করুন
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
