import { useEffect, useMemo, useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import {
  createConsumer,
  deleteConsumer,
  getConsumerStats,
  getConsumers,
  type Consumer,
  type ConsumerCategory,
  type ConsumerStatus,
  updateConsumer,
} from "../services/api";

type FormState = {
  name: string;
  nidLast4: string;
  category: ConsumerCategory;
  status: ConsumerStatus;
  ward: string;
};

const emptyForm: FormState = {
  name: "",
  nidLast4: "",
  category: "A",
  status: "Inactive",
  ward: "",
};

export default function BeneficiariesPage() {
  const [tab, setTab] = useState<"long" | "flags">("long");
  const [q, setQ] = useState("");
  const [ward, setWard] = useState<string>("সব");
  const [status, setStatus] = useState("সব");
  const [openAdd, setOpenAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    revoked: 0,
  });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<Consumer | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [consumerData, statData] = await Promise.all([
        getConsumers({ limit: 300 }),
        getConsumerStats(),
      ]);
      setConsumers(consumerData.consumers);
      setStats({
        total: statData.total,
        active: statData.active,
        inactive: statData.inactive,
        revoked: statData.revoked,
      });
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "ডেটা লোড করতে সমস্যা হয়েছে";
      setError(messageText);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    return consumers.filter((c) => {
      const matchQ =
        q.trim() === "" ||
        c.consumerCode.toLowerCase().includes(q.toLowerCase()) ||
        c.name.includes(q) ||
        c.nidLast4.includes(q);

      const matchWard = ward === "সব" || (c.ward ?? "") === ward;
      const matchStatus = status === "সব" || c.status === status;
      const flagged = c.blacklistStatus && c.blacklistStatus !== "None";

      if (tab === "flags") return matchQ && matchWard && flagged;
      return matchQ && matchWard && matchStatus;
    });
  }, [q, ward, status, tab, consumers]);

  const wards = useMemo(() => {
    const unique = new Set<string>();
    consumers.forEach((c) => {
      if (c.ward) unique.add(c.ward);
    });
    return ["সব", ...Array.from(unique)];
  }, [consumers]);

  const saveConsumer = async () => {
    if (!form.name.trim() || form.nidLast4.trim().length !== 4) {
      setError("নাম এবং NID শেষ ৪ ডিজিট সঠিকভাবে দিন");
      return;
    }

    try {
      setLoading(true);
      setError("");

      if (editing) {
        await updateConsumer(editing._id, {
          name: form.name,
          nidLast4: form.nidLast4,
          category: form.category,
          status: form.status,
          ward: form.ward || undefined,
        });
        setMessage("উপকারভোগীর তথ্য আপডেট হয়েছে");
      } else {
        await createConsumer({
          name: form.name,
          nidLast4: form.nidLast4,
          category: form.category,
          status: form.status,
          ward: form.ward || undefined,
        });
        setMessage("নতুন উপকারভোগী যুক্ত হয়েছে");
      }

      setOpenAdd(false);
      setEditing(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "সংরক্ষণ ব্যর্থ হয়েছে";
      setError(messageText);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (consumerId: string) => {
    const confirmed = window.confirm("এই উপকারভোগী মুছে ফেলতে চান?");
    if (!confirmed) return;

    try {
      setLoading(true);
      await deleteConsumer(consumerId);
      setMessage("উপকারভোগী মুছে ফেলা হয়েছে");
      await loadData();
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "মুছে ফেলা যায়নি";
      setError(messageText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <PortalSection
        title="উপকারভোগী ব্যবস্থাপনা"
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => window.print()}>
              🖨️ প্রিন্ট
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setOpenAdd(true);
              }}
            >
              ➕ নতুন নিবন্ধন
            </Button>
          </div>
        }
      >
        {(error || message) && (
          <div
            className={`mb-3 rounded border px-3 py-2 text-[12px] ${error ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]" : "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"}`}
          >
            {error || message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="border rounded p-2 bg-white text-[12px]">
            মোট: <b>{stats.total}</b>
          </div>
          <div className="border rounded p-2 bg-[#ecfdf5] text-[12px]">
            সক্রিয়: <b>{stats.active}</b>
          </div>
          <div className="border rounded p-2 bg-[#fffbeb] text-[12px]">
            নিষ্ক্রিয়: <b>{stats.inactive}</b>
          </div>
          <div className="border rounded p-2 bg-[#fef2f2] text-[12px]">
            বাতিল: <b>{stats.revoked}</b>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setTab("long")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "long"
                ? "bg-[#1f77b4] text-white border-[#1f77b4]"
                : "bg-white border-[#cfd6e0]"
            }`}
          >
            🟦 লং লিস্ট (নিবন্ধন)
          </button>
          <button
            onClick={() => setTab("flags")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "flags"
                ? "bg-[#1f77b4] text-white border-[#1f77b4]"
                : "bg-white border-[#cfd6e0]"
            }`}
          >
            ⚠ ডুপ্লিকেট/ফ্ল্যাগড
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="সার্চ: ID / নাম / NID (শেষ ৪ ডিজিট)"
          />
          <select
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            {wards.map((optionWard) => (
              <option key={optionWard} value={optionWard}>
                {optionWard}
              </option>
            ))}
          </select>
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
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => void loadData()}
            >
              রিফ্রেশ
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

        {/* Table */}
        <div className="border border-[#cfd6e0] rounded overflow-hidden">
          <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold flex items-center justify-between">
            <span>তালিকা</span>
            <span className="text-[12px] text-[#6b7280]">
              মোট: {filtered.length}
            </span>
          </div>

          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-225 text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="border border-[#cfd6e0] p-2">ID</th>
                  <th className="border border-[#cfd6e0] p-2">নাম</th>
                  <th className="border border-[#cfd6e0] p-2">NID</th>
                  <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                  <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                  <th className="border border-[#cfd6e0] p-2">
                    ফ্যামিলি ফ্ল্যাগ
                  </th>
                  <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c._id} className="odd:bg-white even:bg-[#f8fafc]">
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {c.consumerCode}
                    </td>
                    <td className="border border-[#cfd6e0] p-2">{c.name}</td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      ****{c.nidLast4}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {c.ward || "—"}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {c.status === "Active" && (
                        <Badge tone="green">সক্রিয়</Badge>
                      )}
                      {c.status === "Inactive" && (
                        <Badge tone="yellow">নিষ্ক্রিয়</Badge>
                      )}
                      {c.status === "Revoked" && (
                        <Badge tone="red">বাতিল</Badge>
                      )}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {c.blacklistStatus && c.blacklistStatus !== "None" ? (
                        <Badge tone="red">⚠ ফ্ল্যাগড</Badge>
                      ) : (
                        <Badge tone="gray">না</Badge>
                      )}
                    </td>
                    <td className="border border-[#cfd6e0] p-2">
                      <div className="flex flex-wrap gap-1 justify-center">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditing(c);
                            setForm({
                              name: c.name,
                              nidLast4: c.nidLast4,
                              category: c.category,
                              status: c.status,
                              ward: c.ward || "",
                            });
                            setOpenAdd(true);
                          }}
                        >
                          ✏️ এডিট
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void onDelete(c._id)}
                        >
                          🗑️ মুছুন
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-[#6b7280]">
                      {loading ? "লোড হচ্ছে..." : "কোনো ডেটা পাওয়া যায়নি।"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PortalSection>

      <Modal
        open={openAdd}
        title={editing ? "উপকারভোগী আপডেট" : "নতুন উপকারভোগী নিবন্ধন"}
        onClose={() => setOpenAdd(false)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[12px] mb-1 font-medium">নাম</div>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              placeholder="নাম লিখুন"
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">NID শেষ ৪ ডিজিট</div>
            <input
              value={form.nidLast4}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  nidLast4: e.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              placeholder="1234"
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">ক্যাটাগরি</div>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  category: e.target.value as ConsumerCategory,
                }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">স্ট্যাটাস</div>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  status: e.target.value as ConsumerStatus,
                }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
            >
              <option value="Inactive">Inactive</option>
              <option value="Active">Active</option>
              <option value="Revoked">Revoked</option>
            </select>
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">ওয়ার্ড</div>
            <input
              value={form.ward}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, ward: e.target.value }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              placeholder="যেমন: ওয়ার্ড-০১"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setOpenAdd(false)}>
            বাতিল
          </Button>
          <Button onClick={() => void saveConsumer()} disabled={loading}>
            সংরক্ষণ করুন
          </Button>
        </div>
      </Modal>
    </div>
  );
}
