import { useEffect, useMemo, useState } from "react";
import {
  deactivateConsumer,
  getAdminConsumerReview,
  reactivateConsumer,
  requestAuditReport,
  runEligibilityNow,
  type AdminConsumerReviewRow,
} from "../../services/api";
import SectionCard from "../../components/SectionCard";

export default function AdminEligibilityPage() {
  const [rows, setRows] = useState<AdminConsumerReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [division, setDivision] = useState("");
  const [ward, setWard] = useState("");
  const [status, setStatus] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [blacklist, setBlacklist] = useState("");
  const [cardStatus, setCardStatus] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [auditNeeded, setAuditNeeded] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      if (ward && !division) {
        setError("ওয়ার্ড ফিল্টার ব্যবহার করতে বিভাগ নির্বাচন করুন");
        setRows([]);
        return;
      }

      const response = await getAdminConsumerReview({
        limit: 300,
        division: division || undefined,
        ward: ward || undefined,
        status: status || undefined,
        familyFlag: flaggedOnly ? true : undefined,
        blacklistStatus:
          (blacklist as "None" | "Temp" | "Permanent") || undefined,
        cardStatus:
          (cardStatus as "Active" | "Inactive" | "Revoked") || undefined,
        qrStatus:
          (qrStatus as "Valid" | "Invalid" | "Revoked" | "Expired") ||
          undefined,
        auditNeeded: auditNeeded ? true : undefined,
        search: search || undefined,
      });

      setRows(response.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    division,
    ward,
    status,
    flaggedOnly,
    blacklist,
    cardStatus,
    qrStatus,
    auditNeeded,
  ]);

  const divisionOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.division || "").filter(Boolean)),
      ),
    [rows],
  );

  const wardOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .filter((row) => (division ? row.division === division : true))
            .map((row) => row.ward || "")
            .filter(Boolean),
        ),
      ),
    [rows, division],
  );

  const summary = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === "Active").length;
    const reviewNeeded = rows.filter(
      (r) => r.status === "inactive_review" || r.auditNeeded,
    ).length;
    const blacklisted = rows.filter((r) => r.blacklistStatus !== "None").length;
    const flagged = rows.filter((r) => r.familyFlag).length;
    return { total, active, reviewNeeded, blacklisted, flagged };
  }, [rows]);

  const onFlag = async () => {
    try {
      setLoading(true);
      const r = await runEligibilityNow();
      setMessage(`${r.flagged} জন ভোক্তা চিহ্নিত হয়েছে`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "অপারেশন ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const setEligibilityStatus = async (
    id: string,
    nextStatus: "Active" | "inactive_review",
  ) => {
    try {
      setLoading(true);
      if (nextStatus === "Active") {
        await reactivateConsumer(id);
      } else {
        await deactivateConsumer(id);
      }
      setMessage("স্ট্যাটাস আপডেট হয়েছে");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "অপারেশন ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onRequestAudit = async (row: AdminConsumerReviewRow) => {
    if (!row.distributorUserId) {
      setError("এই ভোক্তার জন্য নির্ধারিত ডিস্ট্রিবিউটর নেই");
      return;
    }
    try {
      setLoading(true);
      await requestAuditReport({
        distributorUserId: row.distributorUserId,
        note: `Eligibility audit request: ${row.consumerCode} (${row.division || ""}/${row.ward || ""})`,
      });
      setMessage("অডিট অনুরোধ পাঠানো হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "অডিট অনুরোধ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> যোগ্যতা ও অপারেশন যাচাই
      </div>

      {(error || message) && (
        <div
          className={`rounded px-3 py-2 text-[12px] border ${error ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]" : "bg-[#ecfdf3] border-[#86efac] text-[#166534]"}`}
        >
          {error || message}
        </div>
      )}

      <SectionCard title="Eligibility summary (DB-truth)">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[13px]">
          <div className="border border-[#d7dde6] rounded p-3 bg-[#fafbfc]">
            মোট: <b>{summary.total}</b>
          </div>
          <div className="border border-[#d7dde6] rounded p-3 bg-[#ecfdf3]">
            সক্রিয়: <b>{summary.active}</b>
          </div>
          <div className="border border-[#d7dde6] rounded p-3 bg-[#fff7ed]">
            রিভিউ-প্রয়োজন: <b>{summary.reviewNeeded}</b>
          </div>
          <div className="border border-[#d7dde6] rounded p-3 bg-[#fef2f2]">
            ব্ল্যাকলিস্ট: <b>{summary.blacklisted}</b>
          </div>
          <div className="border border-[#d7dde6] rounded p-3 bg-[#f5f3ff]">
            ফ্যামিলি-ফ্ল্যাগড: <b>{summary.flagged}</b>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="ফিল্টার ও অপারেশন">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
          <select
            value={division}
            onChange={(e) => {
              setDivision(e.target.value);
              setWard("");
            }}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">সব বিভাগ</option>
            {divisionOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">সব ওয়ার্ড</option>
            {wardOptions.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">সব স্ট্যাটাস</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Revoked">Revoked</option>
            <option value="inactive_review">inactive_review</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="কোড/নাম/NID শেষ ৪"
          />
          <button
            onClick={() => void load()}
            className="px-3 py-2 rounded bg-[#16679c] text-white text-[13px]"
          >
            🔄 রিফ্রেশ
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
          <select
            value={blacklist}
            onChange={(e) => setBlacklist(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">ব্ল্যাকলিস্ট: সব</option>
            <option value="None">None</option>
            <option value="Temp">Temp</option>
            <option value="Permanent">Permanent</option>
          </select>
          <select
            value={cardStatus}
            onChange={(e) => setCardStatus(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">কার্ড: সব</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Revoked">Revoked</option>
          </select>
          <select
            value={qrStatus}
            onChange={(e) => setQrStatus(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">QR: সব</option>
            <option value="Valid">Valid</option>
            <option value="Invalid">Invalid</option>
            <option value="Revoked">Revoked</option>
            <option value="Expired">Expired</option>
          </select>
          <label className="inline-flex items-center gap-2 border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
            />
            শুধু ফ্ল্যাগড
          </label>
          <label className="inline-flex items-center gap-2 border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white">
            <input
              type="checkbox"
              checked={auditNeeded}
              onChange={(e) => setAuditNeeded(e.target.checked)}
            />
            Audit needed
          </label>
        </div>

        <button
          onClick={() => void onFlag()}
          className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded px-4 py-2 text-[13px]"
        >
          এখনই inactive-review ফ্ল্যাগ চালান
        </button>
      </SectionCard>

      <SectionCard title="যোগ্যতা তালিকা">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {[
                  "কোড",
                  "নাম",
                  "বিভাগ",
                  "ওয়ার্ড",
                  "স্ট্যাটাস",
                  "ফ্ল্যাগ",
                  "ব্ল্যাকলিস্ট",
                  "কার্ড/QR",
                  "অ্যাকশন",
                ].map((h) => (
                  <th
                    key={h}
                    className="p-2 border border-[#d7dde6] bg-[#f3f5f8] text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">
                    {row.consumerCode}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{row.name}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.division || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.ward || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{row.status}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.familyFlag ? "⚠️" : "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.blacklistStatus || "None"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.cardStatus || "—"} / {row.qrStatus || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() =>
                          void setEligibilityStatus(row.id, "Active")
                        }
                        className="bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1 text-[11px]"
                      >
                        Active
                      </button>
                      <button
                        onClick={() =>
                          void setEligibilityStatus(row.id, "inactive_review")
                        }
                        className="bg-amber-600 hover:bg-amber-700 text-white rounded px-2 py-1 text-[11px]"
                      >
                        Review
                      </button>
                      <button
                        onClick={() => void onRequestAudit(row)}
                        className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded px-2 py-1 text-[11px]"
                      >
                        Audit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-500">
                    {loading ? "লোড হচ্ছে..." : "কোনো তথ্য নেই"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
