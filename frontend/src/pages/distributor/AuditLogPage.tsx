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

  const loadData = async (
    targetPage = page,
    override?: Partial<{
      search: string;
      action: string;
      severity: AuditSeverity | "";
      from: string;
      to: string;
    }>,
  ) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [data, requestData] = await Promise.all([
        getAuditLogs({
          page: targetPage,
          limit: DEFAULT_LIMIT,
          search: (override?.search ?? search).trim() || undefined,
          action: (override?.action ?? action).trim() || undefined,
          severity: (override?.severity ?? severity) || undefined,
          from: (override?.from ?? from) || undefined,
          to: (override?.to ?? to) || undefined,
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
    () =>
      Array.from(
        new Set([
          ...logs.map((log) => log.action),
          "TOKEN_ISSUED",
          "WEIGHT_MISMATCH",
          "TOKEN_CANCELLED",
          "DISTRIBUTION_SESSION_STARTED",
          "DISTRIBUTION_SESSION_CLOSED",
          "BLACKLIST_CREATED",
          "OFFLINE_QUEUE_SYNC_FAILED",
          "OFFLINE_QUEUE_SYNCED",
        ]),
      ).slice(0, 100),
    [logs],
  );

  const auditSummary = useMemo(() => {
    const total = logs.length;
    const critical = logs.filter((log) => log.severity === "Critical").length;
    const warning = logs.filter((log) => log.severity === "Warning").length;
    const info = logs.filter((log) => log.severity === "Info").length;
    return { total, critical, warning, info };
  }, [logs]);

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

  const onPrint = () => {
    const win = window.open("", "_blank", "width=1200,height=820");
    if (!win) return;

    const filters = [
      search ? `Search: ${search}` : "",
      action ? `Action: ${action}` : "",
      severity ? `Severity: ${severity}` : "",
      from ? `From: ${from}` : "",
      to ? `To: ${to}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    win.document.write(`
      <html>
      <head>
        <title>Amar Ration Audit Log</title>
        <style>
          body{font-family:Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a}
          .wrap{padding:20px}
          .card{background:#fff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden}
          .head{padding:14px 16px;background:linear-gradient(120deg,#0b4f88,#0284c7,#14b8a6);color:#fff}
          .head h2{margin:0;font-size:20px}
          .meta{padding:10px 16px;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0}
          table{width:100%;border-collapse:collapse;font-size:11px}
          th,td{border:1px solid #cbd5e1;padding:6px;vertical-align:top}
          th{background:#f1f5f9}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <div class="head"><h2>আমার রেশন — ডিস্ট্রিবিউটর অডিট লগ</h2></div>
            <div class="meta">Rows: ${logs.length} | Printed: ${new Date().toLocaleString("bn-BD")}</div>
            <div class="meta">Filters: ${filters || "None"}</div>
            <table>
              <thead>
                <tr>
                  <th>সময়</th><th>ইভেন্ট</th><th>এলাকা/সেশন</th><th>কনজিউমার/টোকেন</th><th>অ্যাক্টর</th><th>রেফারেন্স</th><th>গুরুত্ব</th>
                </tr>
              </thead>
              <tbody>
                ${logs
                  .map(
                    (log) => `<tr>
                      <td>${new Date(log.createdAt).toLocaleString("bn-BD")}</td>
                      <td>${log.action}</td>
                      <td>${log.division || "—"} / ${log.ward || "—"}<br/>${log.sessionCode || ""}</td>
                      <td>${log.consumerCode || "—"}<br/>${log.tokenCode || ""}</td>
                      <td>${log.actorName || log.actorType || "—"}<br/>${log.distributorName || ""}</td>
                      <td>${log.entityType || "—"} / ${log.entityId || "—"}</td>
                      <td>${log.severity}</td>
                    </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
        <script>window.onload=()=>window.print()</script>
      </body>
      </html>
    `);
    win.document.close();
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
            <Button variant="secondary" onClick={onPrint}>
              🖨️ প্রিন্ট প্রিভিউ
            </Button>
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
                void loadData(1, {
                  search: "",
                  action: "",
                  severity: "",
                  from: "",
                  to: "",
                });
              }}
            >
              রিসেট
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-[12px]">
          <div className="border rounded p-2 bg-[#f8fafc]">
            মোট: <b>{auditSummary.total}</b>
          </div>
          <div className="border rounded p-2 bg-[#fef2f2]">
            Critical: <b>{auditSummary.critical}</b>
          </div>
          <div className="border rounded p-2 bg-[#fffbeb]">
            Warning: <b>{auditSummary.warning}</b>
          </div>
          <div className="border rounded p-2 bg-[#ecfdf5]">
            Info: <b>{auditSummary.info}</b>
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
                <th className="border p-2">এলাকা/সেশন</th>
                <th className="border p-2">কনজিউমার/টোকেন</th>
                <th className="border p-2">অ্যাক্টর/ডিস্ট্রিবিউটর</th>
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
                    {(log.division || "—") + " / " + (log.ward || "—")}
                    <div className="text-[10px] text-[#64748b]">
                      {log.sessionCode || ""}
                    </div>
                  </td>
                  <td className="border p-2 text-center">
                    {log.consumerCode || "—"}
                    <div className="text-[10px] text-[#64748b]">
                      {log.tokenCode || ""}
                    </div>
                  </td>
                  <td className="border p-2 text-center">
                    {log.actorName || log.actorType || "—"}
                    <div className="text-[10px] text-[#64748b]">
                      {log.distributorName || ""}
                    </div>
                  </td>
                  <td className="border p-2 text-center">
                    {log.entityType || "—"} / {log.entityId || "—"}
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
                    colSpan={7}
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
                      ) : req.reportText?.trim() ||
                        (req.attachments && req.attachments.length > 0) ? (
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
              সহায়ক ডকুমেন্ট (সর্বোচ্চ ১০টি, প্রতিটি ১০MB)
            </div>
            <input
              type="file"
              multiple
              onChange={(e) =>
                setReportFiles(Array.from(e.target.files || []).slice(0, 10))
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
