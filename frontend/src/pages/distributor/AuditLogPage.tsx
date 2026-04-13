import { useEffect, useMemo, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import {
  downloadDistributorAuditRequestFile,
  exportAuditLogsCsv,
  getAuditLogs,
  getDistributorAuditRequests,
  submitAuditReport,
  type AuditLogEntry,
  type AuditSeverity,
  type AuditReportRequest,
} from "../../services/api";

const DEFAULT_LIMIT = 20;

function severityTone(severity: AuditSeverity) {
  if (severity === "Critical") return "red" as const;
  if (severity === "Warning") return "yellow" as const;
  return "green" as const;
}

function severityLabel(severity: AuditSeverity) {
  if (severity === "Critical") return "গুরুতর";
  if (severity === "Warning") return "সতর্ক";
  return "তথ্য";
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [severity, setSeverity] = useState<AuditSeverity | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [requests, setRequests] = useState<AuditReportRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<AuditReportRequest | null>(
    null,
  );
  const [reportText, setReportText] = useState("");
  const [reportFiles, setReportFiles] = useState<File[]>([]);

  const loadData = async (targetPage = page) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [data, requestData] = await Promise.all([
        getAuditLogs({
          page: targetPage,
          limit: DEFAULT_LIMIT,
          search: search.trim() || undefined,
          action: action.trim() || undefined,
          severity: severity || undefined,
          from: from || undefined,
          to: to || undefined,
        }),
        getDistributorAuditRequests(),
      ]);

      setLogs(data.logs);
      setPage(data.pagination.page);
      setPages(Math.max(1, data.pagination.pages || 1));
      setRequests(requestData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "অডিট লগ লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uniqueActions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).slice(0, 50),
    [logs],
  );

  const onExport = async () => {
    setError("");
    setMessage("");
    try {
      const blob = await exportAuditLogsCsv({
        search: search.trim() || undefined,
        action: action.trim() || undefined,
        severity: severity || undefined,
        from: from || undefined,
        to: to || undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `audit-logs-${Date.now()}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setMessage("CSV এক্সপোর্ট সম্পন্ন হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV এক্সপোর্ট ব্যর্থ");
    }
  };

  const onSubmitReport = async () => {
    if (!activeRequest) return;
    try {
      setLoading(true);
      await submitAuditReport(activeRequest._id, reportText, reportFiles);
      setMessage("অডিট রিপোর্ট জমা হয়েছে");
      setActiveRequest(null);
      setReportText("");
      setReportFiles([]);
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিপোর্ট জমা ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onDownloadAttachment = async (
    requestId: string,
    fileId: string,
    fileName: string,
  ) => {
    try {
      const blob = await downloadDistributorAuditRequestFile(requestId, fileId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName || `attachment-${fileId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ফাইল ডাউনলোড ব্যর্থ");
    }
  };

  return (
    <div className="space-y-3">
      <PortalSection
        title="অডিট লগ (Immutable)"
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void onExport()}>
              ⬇️ এক্সপোর্ট CSV
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowAdvanced((prev) => !prev)}
            >
              🔍 অ্যাডভান্স ফিল্টার
            </Button>
          </div>
        }
      >
        {(error || message) && (
          <div
            className={`mb-3 rounded border px-3 py-2 text-[12px] ${
              error
                ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]"
                : "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="সার্চ: ইভেন্ট / রেফারেন্স"
            className="border rounded px-3 py-2 text-[13px]"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as AuditSeverity | "")}
            className="border rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">সব গুরুত্ব</option>
            <option value="Info">তথ্য</option>
            <option value="Warning">সতর্ক</option>
            <option value="Critical">গুরুতর</option>
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="border rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">সব ইভেন্ট</option>
            {uniqueActions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => void loadData(1)}
              disabled={loading}
            >
              রিফ্রেশ
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setAction("");
                setSeverity("");
                setFrom("");
                setTo("");
                void loadData(1);
              }}
            >
              রিসেট
            </Button>
          </div>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border rounded px-3 py-2 text-[13px]"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border rounded px-3 py-2 text-[13px]"
            />
          </div>
        )}

        <div className="border rounded overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">সময়</th>
                <th className="border p-2">ইভেন্ট</th>
                <th className="border p-2">এনটিটি</th>
                <th className="border p-2">রেফারেন্স</th>
                <th className="border p-2">গুরুত্ব</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td className="border p-2 text-center">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="border p-2">{log.action}</td>
                  <td className="border p-2 text-center">
                    {log.entityType || "—"}
                  </td>
                  <td className="border p-2 text-center">
                    {log.entityId || "—"}
                  </td>
                  <td className="border p-2 text-center">
                    <Badge tone={severityTone(log.severity)}>
                      {severityLabel(log.severity)}
                    </Badge>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="border p-4 text-center text-[#6b7280]"
                  >
                    {loading ? "লোড হচ্ছে..." : "কোনো অডিট লগ নেই"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span>
            পৃষ্ঠা {page} / {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => void loadData(page - 1)}
              disabled={loading || page <= 1}
            >
              ← আগের
            </Button>
            <Button
              variant="secondary"
              onClick={() => void loadData(page + 1)}
              disabled={loading || page >= pages}
            >
              পরের →
            </Button>
          </div>
        </div>
      </PortalSection>

      <PortalSection title="অডিট রিপোর্ট রিকোয়েস্ট">
        {requests.length === 0 ? (
          <div className="text-[12px] text-[#6b7280]">
            কোনো পেন্ডিং রিকোয়েস্ট নেই
          </div>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f8fafc]">
                <tr>
                  <th className="border p-2">স্ট্যাটাস</th>
                  <th className="border p-2">ডেডলাইন</th>
                  <th className="border p-2">সময়</th>
                  <th className="border p-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req._id}>
                    <td className="border p-2 text-center">{req.status}</td>
                    <td className="border p-2 text-center">
                      {req.dueAt
                        ? new Date(req.dueAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="border p-2 text-center">
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                    <td className="border p-2 text-center">
                      {req.status === "Requested" ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setActiveRequest(req);
                            setReportText("");
                            setReportFiles([]);
                          }}
                        >
                          রিপোর্ট জমা দিন
                        </Button>
                      ) : req.attachments && req.attachments.length > 0 ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setActiveRequest(req);
                            setReportText(req.reportText || "");
                            setReportFiles([]);
                          }}
                        >
                          জমা রিপোর্ট দেখুন
                        </Button>
                      ) : (
                        "জমা হয়েছে"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalSection>

      <Modal
        open={!!activeRequest}
        title="অডিট রিপোর্ট জমা"
        onClose={() => setActiveRequest(null)}
      >
        <div className="space-y-2 text-[13px]">
          <div>
            <strong>নির্দেশনা:</strong> {activeRequest?.note || "—"}
          </div>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            className="w-full border rounded px-3 py-2 text-[12px]"
            rows={5}
            placeholder="অডিট রিপোর্ট লিখুন"
          />

          <div className="space-y-2">
            <div className="text-[12px] text-[#6b7280]">
              সহায়ক ডকুমেন্ট (সর্বোচ্চ ৫টি, প্রতিটি ১০MB)
            </div>
            <input
              type="file"
              multiple
              onChange={(e) =>
                setReportFiles(Array.from(e.target.files || []).slice(0, 5))
              }
              className="w-full border rounded px-3 py-2 text-[12px] bg-white"
            />
            {reportFiles.length > 0 && (
              <div className="rounded border bg-[#f8fafc] p-2 text-[12px] space-y-1">
                {reportFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`}>
                    {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
                  </div>
                ))}
              </div>
            )}

            {activeRequest?.attachments &&
              activeRequest.attachments.length > 0 && (
                <div className="rounded border bg-white p-2 space-y-1">
                  <div className="text-[12px] font-medium">
                    আগে জমা দেওয়া ফাইল
                  </div>
                  {activeRequest.attachments.map((file) => (
                    <div
                      key={file._id}
                      className="flex items-center justify-between text-[12px]"
                    >
                      <span>{file.originalName}</span>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void onDownloadAttachment(
                            activeRequest._id,
                            file._id,
                            file.originalName,
                          )
                        }
                      >
                        ডাউনলোড
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setActiveRequest(null)}>
              বন্ধ
            </Button>
            <Button onClick={() => void onSubmitReport()} disabled={loading}>
              জমা দিন
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
