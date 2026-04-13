import { useEffect, useMemo, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { useAuth } from "../../context/useAuth";
import {
  bulkRegisterTemplate,
  bulkRegisterUpload,
  createConsumer,
  deleteConsumer,
  getConsumerStats,
  getConsumers,
  type Consumer,
  type ConsumerCategory,
  type ConsumerStatus,
  updateConsumer,
} from "../../services/api";

type FormState = {
  name: string;
  nidFull: string;
  fatherNidFull: string;
  motherNidFull: string;
  guardianPhone: string;
  guardianName: string;
  category: ConsumerCategory;
  status: ConsumerStatus;
};

const emptyForm: FormState = {
  name: "",
  nidFull: "",
  fatherNidFull: "",
  motherNidFull: "",
  guardianPhone: "",
  guardianName: "",
  category: "A",
  status: "Inactive",
};

export default function BeneficiariesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"long" | "flags">("long");
  const [q, setQ] = useState("");
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
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkDryRun, setBulkDryRun] = useState(true);

  const normalizeNid = (value: string) => value.replace(/\D/g, "");
  const isValidNid = (value: string) =>
    value.length === 10 || value.length === 13 || value.length === 17;

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

      const matchStatus = status === "সব" || c.status === status;
      const flagged =
        (c.blacklistStatus && c.blacklistStatus !== "None") || c.familyFlag;

      if (tab === "flags") return matchQ && flagged;
      return matchQ && matchStatus;
    });
  }, [q, status, tab, consumers]);

  const saveConsumer = async () => {
    const consumerNid = normalizeNid(form.nidFull);
    const fatherNid = normalizeNid(form.fatherNidFull);
    const motherNid = normalizeNid(form.motherNidFull);

    if (
      !form.name.trim() ||
      !isValidNid(consumerNid) ||
      !isValidNid(fatherNid) ||
      !isValidNid(motherNid)
    ) {
      setError("নাম এবং নিজ/পিতা/মাতার NID ১০/১৩/১৭ ডিজিট হতে হবে");
      return;
    }

    try {
      setLoading(true);
      setError("");

      if (editing) {
        await updateConsumer(editing._id, {
          name: form.name,
          nidFull: consumerNid,
          fatherNidFull: fatherNid,
          motherNidFull: motherNid,
          guardianPhone: form.guardianPhone.trim() || undefined,
          guardianName: form.guardianName.trim() || undefined,
          category: form.category,
          status: form.status,
        });
        setMessage("উপকারভোগীর তথ্য আপডেট হয়েছে");
      } else {
        await createConsumer({
          name: form.name,
          nidFull: consumerNid,
          fatherNidFull: fatherNid,
          motherNidFull: motherNid,
          guardianPhone: form.guardianPhone.trim() || undefined,
          guardianName: form.guardianName.trim() || undefined,
          category: form.category,
          status: "Inactive",
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
      <PortalSection title="বাল্ক নিবন্ধন (ডিস্ট্রিবিউটর)">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            type="file"
            accept=".csv,text/csv"
            className="md:col-span-2 border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
            onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
          />
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={bulkDryRun}
              onChange={(e) => setBulkDryRun(e.target.checked)}
            />
            ড্রাই-রান
          </label>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                void (async () => {
                  const blob = await bulkRegisterTemplate();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "bulk-register-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                })()
              }
            >
              টেমপ্লেট
            </Button>
            <Button
              onClick={() =>
                void (async () => {
                  if (!bulkFile) {
                    setError("CSV ফাইল নির্বাচন করুন");
                    return;
                  }
                  try {
                    setLoading(true);
                    const result = await bulkRegisterUpload(
                      bulkFile,
                      bulkDryRun,
                    );
                    setMessage(
                      `${result.inserted} টি সফল, ${result.skipped} টি স্কিপ হয়েছে`,
                    );
                    await loadData();
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "বাল্ক আপলোড ব্যর্থ",
                    );
                  } finally {
                    setLoading(false);
                  }
                })()
              }
            >
              আপলোড
            </Button>
          </div>
        </div>
        <p className="text-[12px] text-[#6b7280] mt-2">
          নোট: আপনি কেবল আপনার নিজস্ব division/ward এর ভোক্তাদের বাল্ক নিবন্ধন
          করতে পারবেন। guardianName কলাম না থাকলেও আপলোড হবে।
        </p>
      </PortalSection>

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
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
            disabled={tab === "flags"}
          >
            <option value="সব">সব স্ট্যাটাস</option>
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
                  <th className="border border-[#cfd6e0] p-2">
                    বিভাগ / ওয়ার্ড
                  </th>
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
                      <div>{c.division || "—"}</div>
                      <div className="text-[11px] text-[#6b7280]">
                        {c.ward || "—"}
                      </div>
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
                      {c.familyFlag ? (
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
                              nidFull: c.nidFull || "",
                              fatherNidFull: c.fatherNidFull || "",
                              motherNidFull: c.motherNidFull || "",
                              guardianPhone: c.guardianPhone || "",
                              guardianName: c.guardianName || "",
                              category: c.category,
                              status: c.status,
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
            <div className="text-[12px] mb-1 font-medium">নিজের NID</div>
            <input
              value={form.nidFull}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  nidFull: normalizeNid(e.target.value),
                }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              placeholder="১০/১৩/১৭ ডিজিট"
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">পিতার NID</div>
            <input
              value={form.fatherNidFull}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  fatherNidFull: normalizeNid(e.target.value),
                }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              placeholder="১০/১৩/১৭ ডিজিট"
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">মাতার NID</div>
            <input
              value={form.motherNidFull}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  motherNidFull: normalizeNid(e.target.value),
                }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              placeholder="১০/১৩/১৭ ডিজিট"
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
            <div className="text-[12px] mb-1 font-medium">অভিভাবকের মোবাইল</div>
            <input
              value={form.guardianPhone}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  guardianPhone: e.target.value.replace(/\D/g, "").slice(0, 11),
                }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">অভিভাবকের নাম</div>
            <input
              value={form.guardianName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, guardianName: e.target.value }))
              }
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              placeholder="অভিভাবকের নাম লিখুন"
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              ওয়ার্ড{" "}
              <span className="text-gray-400">
                (অ্যাডমিন নির্ধারিত — পরিবর্তনযোগ্য নয়)
              </span>
            </div>
            <input
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-gray-100 cursor-not-allowed text-gray-500"
              value={`${user?.division || "—"} • ${user?.ward || user?.wardNo || "—"}`}
              readOnly
            />
          </div>
          <div>
            {editing ? (
              <>
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
                  <option value="Inactive">নিষ্ক্রিয়</option>
                  <option value="Revoked">বাতিল</option>
                </select>
              </>
            ) : (
              <>
                <div className="text-[12px] mb-1 font-medium">স্ট্যাটাস</div>
                <input
                  value="Inactive — অ্যাডমিন সক্রিয় করবেন"
                  readOnly
                  className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-gray-100 text-gray-500"
                />
              </>
            )}
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
