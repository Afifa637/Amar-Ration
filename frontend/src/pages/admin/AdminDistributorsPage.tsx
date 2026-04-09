import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import {
  adminResetDistributorPassword,
  createAdminDistributor,
  deleteAdminDistributor,
  getAdminDistributors,
  updateAdminDistributorStatus,
  type AdminDistributorRow,
} from "../../services/api";

type CreateDistributorForm = {
  name: string;
  email: string;
  phone: string;
  wardNo: string;
  ward: string;
  division: string;
  district: string;
  upazila: string;
  unionName: string;
  officeAddress: string;
  authorityMonths: number;
};

const emptyCreateForm: CreateDistributorForm = {
  name: "",
  email: "",
  phone: "",
  wardNo: "",
  ward: "",
  division: "",
  district: "",
  upazila: "",
  unionName: "",
  officeAddress: "",
  authorityMonths: 6,
};

const BANGLADESH_DIVISIONS = [
  "Dhaka",
  "Chattogram",
  "Rajshahi",
  "Khulna",
  "Barishal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
];

const normalizeWardNo = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return String(parseInt(digits, 10)).padStart(2, "0");
};

export default function AdminDistributorsPage() {
  const [rows, setRows] = useState<AdminDistributorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] =
    useState<CreateDistributorForm>(emptyCreateForm);

  const [openReset, setOpenReset] = useState<AdminDistributorRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await getAdminDistributors();
      setRows(data.rows || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ডিস্ট্রিবিউটর ডেটা লোড ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  const createDistributor = async () => {
    if (
      !createForm.name.trim() ||
      !createForm.email.trim() ||
      !createForm.division.trim() ||
      !createForm.wardNo.trim()
    ) {
      setError("চিহ্নিত (*) বাধ্যতামূলক তথ্য পূরণ করুন");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await createAdminDistributor({
        ...createForm,
        wardNo: normalizeWardNo(createForm.wardNo),
        authorityMonths: Math.max(1, Number(createForm.authorityMonths) || 6),
      });
      setOpenCreate(false);
      setCreateForm(emptyCreateForm);
      setMessage(
        "ডিস্ট্রিবিউটর তৈরি সফল হয়েছে। প্রদত্ত ইমেইলে লগইন তথ্য পাঠানো হয়েছে।",
      );
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ডিস্ট্রিবিউটর তৈরি ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  const submitResetPassword = async () => {
    if (!openReset) return;
    if (!resetPassword || resetPassword.length < 8) {
      setError("নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে");
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setError("দুটি পাসওয়ার্ড একই নয়");
      return;
    }

    try {
      setResetLoading(true);
      setError("");
      const targetUserId = openReset.userId || openReset.distributorId || "";
      await adminResetDistributorPassword(targetUserId, resetPassword);
      setOpenReset(null);
      setResetPassword("");
      setConfirmResetPassword("");
      setShowResetPassword(false);
      setMessage("পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "পাসওয়ার্ড রিসেট ব্যর্থ");
    } finally {
      setResetLoading(false);
    }
  };

  const authorityExpiry = (row: AdminDistributorRow) => {
    if (!row.authorityTo) return { text: "—", expired: false, near: false };
    const expiry = new Date(row.authorityTo);
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / dayMs);
    return {
      text: expiry.toLocaleDateString("bn-BD", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      expired: diffDays < 0,
      near: diffDays >= 0 && diffDays <= 30,
    };
  };

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo(() => {
    const base = { pending: 0, Active: 0, Suspended: 0, Revoked: 0 } as Record<
      string,
      number
    >;
    rows.forEach((row) => {
      if (row.authorityStatus === "Pending") base.pending += 1;
      if (row.authorityStatus === "Active") base.Active += 1;
      if (row.authorityStatus === "Suspended") base.Suspended += 1;
      if (row.authorityStatus === "Revoked") base.Revoked += 1;
    });
    return base;
  }, [rows]);

  const statusLabel = (status: AdminDistributorRow["authorityStatus"]) => {
    switch (status) {
      case "Active":
        return "সক্রিয়";
      case "Suspended":
        return "স্থগিত";
      case "Revoked":
        return "বাতিল";
      case "Pending":
        return "অপেক্ষমান";
      default:
        return status;
    }
  };

  const updateStatus = async (
    userId: string,
    status: "Active" | "Suspended" | "Revoked",
  ) => {
    try {
      setLoading(true);
      await updateAdminDistributorStatus(userId, status);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "স্ট্যাটাস আপডেট ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const deleteDistributor = async (row: AdminDistributorRow) => {
    const confirmed = window.confirm(
      "এই ডিস্ট্রিবিউটরকে স্থায়ীভাবে মুছে ফেলতে চান? ডেটা থাকলে সিস্টেম মুছতে দেবে না।",
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setError("");
      const result = await deleteAdminDistributor(row.userId);
      setMessage(result.message || "ডিস্ট্রিবিউটর মুছে ফেলা হয়েছে");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডিলিট ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> ডিস্ট্রিবিউটর ম্যানেজমেন্ট
      </div>

      <SectionCard title="ডিস্ট্রিবিউটর অনুমোদন ওয়ার্কফ্লো">
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setOpenCreate(true)}>
            নতুন ডিস্ট্রিবিউটর তৈরি করুন
          </Button>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          {[
            ["অপেক্ষমান আবেদন", String(stats.pending)],
            ["সক্রিয় ডিস্ট্রিবিউটর", String(stats.Active)],
            ["স্থগিত", String(stats.Suspended)],
            ["বাতিল", String(stats.Revoked)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]"
            >
              <div className="text-[#6b7280]">{label}</div>
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

      <SectionCard title="ডিস্ট্রিবিউটর রেকর্ড">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "ডিস্ট্রিবিউটর আইডি",
                  "বিভাগ / ওয়ার্ড",
                  "নাম",
                  "কর্তৃত্বের মেয়াদ",
                  "স্ট্যাটাস",
                  "অডিট ফ্ল্যাগ",
                  "অ্যাডমিন অ্যাকশন",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">{row.userId}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    <div className="font-medium text-[#111827]">
                      {row.division || "—"}
                    </div>
                    <div className="text-[12px] text-[#6b7280]">
                      Ward {row.wardNo || "—"} • {row.ward || "—"}
                    </div>
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{row.name}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {authorityExpiry(row).expired ? (
                      <span className="inline-flex rounded bg-red-100 text-red-700 px-2 py-1 text-[11px] font-semibold">
                        মেয়াদ শেষ
                      </span>
                    ) : (
                      <span
                        className={
                          authorityExpiry(row).near
                            ? "text-orange-600 font-semibold"
                            : "text-[#374151]"
                        }
                      >
                        {authorityExpiry(row).text}
                      </span>
                    )}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {statusLabel(row.authorityStatus)}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.auditRequired ? "রিপোর্ট প্রয়োজন" : "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => updateStatus(row.userId, "Active")}
                        className="text-[12px] px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600"
                      >
                        অনুমোদন
                      </button>
                      <button
                        onClick={() => updateStatus(row.userId, "Suspended")}
                        className="text-[12px] px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
                      >
                        স্থগিত
                      </button>
                      <button
                        onClick={() => updateStatus(row.userId, "Revoked")}
                        className="text-[12px] px-2 py-1 rounded bg-rose-500 text-white hover:bg-rose-600"
                      >
                        বাতিল
                      </button>
                      <button
                        onClick={() => setOpenReset(row)}
                        className="text-[12px] px-2 py-1 rounded bg-[#1f77b4] text-white hover:bg-[#16679c]"
                      >
                        পাসওয়ার্ড রিসেট
                      </button>
                      <button
                        onClick={() => void deleteDistributor(row)}
                        className="text-[12px] px-2 py-1 rounded bg-[#111827] text-white hover:bg-black"
                      >
                        ডিলিট
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="অ্যাডমিন নীতিমালা">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• ডিস্ট্রিবিউটর সেলফ-অ্যাক্টিভেশন বন্ধ।</li>
          <li>• অনুমোদন ওয়ার্ড-ভিত্তিক এবং বাতিলযোগ্য।</li>
          <li>• ফ্রড/রিকনসিলিয়েশন ব্যর্থতায় স্থগিত করা যাবে।</li>
          <li>• প্রতিটি অ্যাকশন অডিট লগে নথিভুক্ত হবে।</li>
        </ul>
      </SectionCard>

      <Modal
        open={openCreate}
        title="নতুন ডিস্ট্রিবিউটর তৈরি"
        onClose={() => setOpenCreate(false)}
      >
        <div className="mb-3 text-[12px] text-[#6b7280]">
          (*) চিহ্নিত ঘরগুলো বাধ্যতামূলক
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[12px] mb-1 font-medium">পূর্ণ নাম *</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="পূর্ণ নাম"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, name: e.target.value }))
              }
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">ইমেইল *</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="ইমেইল"
              value={createForm.email}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, email: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2 rounded border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-[12px] text-[#1e3a8a]">
            সিস্টেম স্বয়ংক্রিয়ভাবে একটি লগইন ইমেইল (যেমন:
            distributorward01@amar-ration.local) ও শক্তিশালী পাসওয়ার্ড তৈরি করে
            প্রদত্ত ইমেইলে পাঠাবে।
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">ফোন নম্বর</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="ফোন নম্বর"
              value={createForm.phone}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, phone: e.target.value }))
              }
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">ওয়ার্ড নম্বর *</div>
            <input
              type="number"
              min={1}
              max={99}
              className="border rounded px-3 py-2 w-full"
              placeholder="ওয়ার্ড নম্বর (যেমন: ০১, ০২)"
              value={createForm.wardNo}
              onChange={(e) =>
                setCreateForm((p) => ({
                  ...p,
                  wardNo: normalizeWardNo(e.target.value),
                }))
              }
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">ওয়ার্ড নাম</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="ওয়ার্ড নাম"
              value={createForm.ward}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, ward: e.target.value }))
              }
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">বিভাগ *</div>
            <select
              className="border rounded px-3 py-2 w-full bg-white"
              value={createForm.division}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, division: e.target.value }))
              }
            >
              <option value="">বিভাগ নির্বাচন করুন</option>
              {BANGLADESH_DIVISIONS.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">জেলা</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="জেলা"
              value={createForm.district}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, district: e.target.value }))
              }
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">উপজেলা</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="উপজেলা"
              value={createForm.upazila}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, upazila: e.target.value }))
              }
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">ইউনিয়ন</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="ইউনিয়ন"
              value={createForm.unionName}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, unionName: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-[12px] mb-1 font-medium">অফিসের ঠিকানা</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="অফিসের ঠিকানা"
              value={createForm.officeAddress}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, officeAddress: e.target.value }))
              }
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              কর্তৃত্বের মেয়াদ (মাস)
            </div>
            <input
              type="number"
              min={1}
              className="border rounded px-3 py-2 w-full"
              placeholder="কর্তৃত্বের মেয়াদ"
              value={createForm.authorityMonths}
              onChange={(e) =>
                setCreateForm((p) => ({
                  ...p,
                  authorityMonths: Math.max(1, Number(e.target.value) || 1),
                }))
              }
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenCreate(false)}>
            বাতিল
          </Button>
          <Button onClick={() => void createDistributor()} disabled={loading}>
            তৈরি করুন
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!openReset}
        title="পাসওয়ার্ড রিসেট"
        onClose={() => setOpenReset(null)}
      >
        <div className="space-y-3 text-[13px]">
          <div className="text-[#374151]">
            ডিস্ট্রিবিউটর: <b>{openReset?.name}</b>
          </div>
          <input
            type={showResetPassword ? "text" : "password"}
            className="w-full border rounded px-3 py-2"
            placeholder="নতুন পাসওয়ার্ড (min 8)"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
          />
          <input
            type={showResetPassword ? "text" : "password"}
            className="w-full border rounded px-3 py-2"
            placeholder="পাসওয়ার্ড নিশ্চিত করুন"
            value={confirmResetPassword}
            onChange={(e) => setConfirmResetPassword(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => setShowResetPassword((v) => !v)}
          >
            {showResetPassword ? "Hide" : "Show"}
          </Button>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenReset(null)}>
              বাতিল
            </Button>
            <Button
              onClick={() => void submitResetPassword()}
              disabled={resetLoading}
            >
              {resetLoading ? "প্রসেস হচ্ছে..." : "পাসওয়ার্ড রিসেট"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
