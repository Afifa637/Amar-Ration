import { useEffect, useMemo, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import api from "../../services/api";

type BeneficiaryRow = {
  id: string;
  consumerCode?: string;
  name: string;
  nidLast4: string;
  status: "Active" | "Inactive" | "Revoked";
  familyFlag: boolean;
  ward: string;
  category?: string;
  blacklistStatus?: string;
  cardStatus?: string | null;
  qrStatus?: string | null;
};

type BeneficiaryResponse = {
  rows: BeneficiaryRow[];
  total: number;
};

export default function BeneficiariesPage() {
  const [tab, setTab] = useState<"long" | "short" | "flags">("long");
  const [q, setQ] = useState("");
  const [ward, setWard] = useState("সব");
  const [status, setStatus] = useState("সব");
  const [openAdd, setOpenAdd] = useState(false);
  const [rows, setRows] = useState<BeneficiaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadBeneficiaries() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("tab", tab);
      if (q.trim()) params.set("q", q.trim());
      if (ward !== "সব") params.set("ward", ward);
      if (status !== "সব") params.set("status", status);

      const res = (await api.get(`/distributor/beneficiaries?${params.toString()}`)) as BeneficiaryResponse;
      setRows(res.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBeneficiaries();
  }, [tab]);

  const filtered = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-3">
      <PortalSection
        title="উপকারভোগী ব্যবস্থাপনা"
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => window.print()}>
              🖨️ প্রিন্ট
            </Button>
            <Button variant="secondary" onClick={() => alert("এক্সপোর্ট API পরে যুক্ত করুন")}>
              ⬇️ এক্সপোর্ট
            </Button>
            <Button onClick={() => setOpenAdd(true)}>➕ নতুন নিবন্ধন</Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setTab("long")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "long" ? "bg-[#1f77b4] text-white border-[#1f77b4]" : "bg-white border-[#cfd6e0]"
            }`}
          >
            🟦 লং লিস্ট (নিবন্ধন)
          </button>
          <button
            onClick={() => setTab("short")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "short" ? "bg-[#1f77b4] text-white border-[#1f77b4]" : "bg-white border-[#cfd6e0]"
            }`}
          >
            🟩 শর্ট লিস্ট (বিতরণ দিন)
          </button>
          <button
            onClick={() => setTab("flags")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "flags" ? "bg-[#1f77b4] text-white border-[#1f77b4]" : "bg-white border-[#cfd6e0]"
            }`}
          >
            ⚠ ডুপ্লিকেট/ফ্ল্যাগড
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="সার্চ: ID / নাম / NID (শেষ ৪ ডিজিট)"
          />
          <input
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
            placeholder="ওয়ার্ড"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
            disabled={tab === "flags"}
          >
            <option>সব</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>Revoked</option>
          </select>

          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={loadBeneficiaries}>
              {loading ? "লোড হচ্ছে..." : "অনুসন্ধান"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
                setWard("সব");
                setStatus("সব");
              }}
            >
              রিসেট
            </Button>
          </div>
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <div className="border border-[#cfd6e0] rounded overflow-hidden">
          <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold flex items-center justify-between">
            <span>তালিকা</span>
            <span className="text-[12px] text-[#6b7280]">মোট: {filtered.length}</span>
          </div>

          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-[1000px] text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="border border-[#cfd6e0] p-2">ID</th>
                  <th className="border border-[#cfd6e0] p-2">নাম</th>
                  <th className="border border-[#cfd6e0] p-2">NID</th>
                  <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                  <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                  <th className="border border-[#cfd6e0] p-2">ফ্যামিলি ফ্ল্যাগ</th>
                  <th className="border border-[#cfd6e0] p-2">কার্ড</th>
                  <th className="border border-[#cfd6e0] p-2">QR</th>
                  <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="odd:bg-white even:bg-[#f8fafc]">
                    <td className="border border-[#cfd6e0] p-2 text-center">{c.consumerCode || c.id}</td>
                    <td className="border border-[#cfd6e0] p-2">{c.name}</td>
                    <td className="border border-[#cfd6e0] p-2 text-center">****{c.nidLast4}</td>
                    <td className="border border-[#cfd6e0] p-2 text-center">{c.ward}</td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {c.status === "Active" && <Badge tone="green">Active</Badge>}
                      {c.status === "Inactive" && <Badge tone="yellow">Inactive</Badge>}
                      {c.status === "Revoked" && <Badge tone="red">Revoked</Badge>}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {c.familyFlag ? <Badge tone="red">⚠ ফ্ল্যাগড</Badge> : <Badge tone="gray">না</Badge>}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">{c.cardStatus || "-"}</td>
                    <td className="border border-[#cfd6e0] p-2 text-center">{c.qrStatus || "-"}</td>
                    <td className="border border-[#cfd6e0] p-2">
                      <div className="flex flex-wrap gap-1 justify-center">
                        <Button variant="ghost" onClick={() => alert(`${c.name} প্রোফাইল দেখার API পরে যোগ করুন`)}>
                          👁️ দেখুন
                        </Button>
                        <Button variant="secondary" onClick={() => alert("Verify/Blacklist write API পরে যোগ করুন")}>
                          ✅ যাচাই
                        </Button>
                        <Button variant="danger" onClick={() => alert("Blacklist write API পরে যোগ করুন")}>
                          🚫 ব্ল্যাকলিস্ট
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-[#6b7280]">
                      কোনো ডেটা পাওয়া যায়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PortalSection>

      <Modal open={openAdd} title="নতুন উপকারভোগী নিবন্ধন" onClose={() => setOpenAdd(false)}>
        <div className="text-[13px] text-[#374151]">
          এই ফর্ম UI প্রস্তুত আছে। সাবমিট API এখনো যোগ করা হয়নি।
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setOpenAdd(false)}>
            বাতিল
          </Button>
          <Button onClick={() => alert("Create beneficiary API পরে যোগ করুন")}>
            সংরক্ষণ করুন
          </Button>
        </div>
      </Modal>
    </div>
  );
}