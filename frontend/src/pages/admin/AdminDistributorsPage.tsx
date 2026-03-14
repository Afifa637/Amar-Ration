import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  getAdminDistributors,
  updateAdminDistributorStatus,
  type AdminDistributorRow,
} from "../../services/api";

export default function AdminDistributorsPage() {
  const [rows, setRows] = useState<AdminDistributorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
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

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> ডিস্ট্রিবিউটর ম্যানেজমেন্ট
      </div>

      <SectionCard title="ডিস্ট্রিবিউটর অনুমোদন ওয়ার্কফ্লো">
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
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
                  "ওয়ার্ড",
                  "নাম",
                  "স্ট্যাটাস",
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
                    {row.ward || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{row.name}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {statusLabel(row.authorityStatus)}
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
    </div>
  );
}
