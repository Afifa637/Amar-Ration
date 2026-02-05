import { useMemo, useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";

type Consumer = {
  id: string;
  name: string;
  nidLast4: string;
  status: "Active" | "Inactive" | "Revoked";
  familyFlag: boolean;
  ward: string;
};

const demo: Consumer[] = [
  { id: "C001", name: "রহিম", nidLast4: "1234", status: "Active", familyFlag: false, ward: "ওয়ার্ড-০১" },
  { id: "C002", name: "করিম", nidLast4: "4567", status: "Inactive", familyFlag: true, ward: "ওয়ার্ড-০১" },
  { id: "C003", name: "আয়েশা", nidLast4: "7788", status: "Active", familyFlag: false, ward: "ওয়ার্ড-০২" },
  { id: "C004", name: "হাসান", nidLast4: "9012", status: "Revoked", familyFlag: true, ward: "ওয়ার্ড-০২" },
];

export default function BeneficiariesPage() {
  const [tab, setTab] = useState<"long" | "short" | "flags">("long");
  const [q, setQ] = useState("");
  const [ward, setWard] = useState("সব");
  const [status, setStatus] = useState("সব");
  const [openAdd, setOpenAdd] = useState(false);

  const filtered = useMemo(() => {
    return demo.filter((c) => {
      const matchQ =
        q.trim() === "" ||
        c.id.toLowerCase().includes(q.toLowerCase()) ||
        c.name.includes(q) ||
        c.nidLast4.includes(q);

      const matchWard = ward === "সব" || c.ward === ward;
      const matchStatus = status === "সব" || c.status === status;

      if (tab === "flags") return matchQ && matchWard && c.familyFlag;
      return matchQ && matchWard && matchStatus;
    });
  }, [q, ward, status, tab]);

  return (
    <div className="space-y-3">
      <PortalSection
        title="উপকারভোগী ব্যবস্থাপনা"
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => alert("ডেমো: তালিকা প্রিন্ট হবে")}>
              🖨️ প্রিন্ট
            </Button>
            <Button variant="secondary" onClick={() => alert("ডেমো: এক্সপোর্ট হবে (Excel/PDF)")}>
              ⬇️ এক্সপোর্ট
            </Button>
            <Button onClick={() => setOpenAdd(true)}>➕ নতুন নিবন্ধন</Button>
          </div>
        }
      >
        {/* Tabs */}
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
            <option>সব</option>
            <option>ওয়ার্ড-০১</option>
            <option>ওয়ার্ড-০২</option>
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
            <Button variant="primary" className="flex-1" onClick={() => alert("ডেমো: সার্চ প্রয়োগ হয়েছে")}>
              অনুসন্ধান
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
            <span className="text-[12px] text-[#6b7280]">মোট: {filtered.length}</span>
          </div>

          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-[900px] text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="border border-[#cfd6e0] p-2">ID</th>
                  <th className="border border-[#cfd6e0] p-2">নাম</th>
                  <th className="border border-[#cfd6e0] p-2">NID</th>
                  <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                  <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                  <th className="border border-[#cfd6e0] p-2">ফ্যামিলি ফ্ল্যাগ</th>
                  <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="odd:bg-white even:bg-[#f8fafc]">
                    <td className="border border-[#cfd6e0] p-2 text-center">{c.id}</td>
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
                    <td className="border border-[#cfd6e0] p-2">
                      <div className="flex flex-wrap gap-1 justify-center">
                        <Button variant="ghost" onClick={() => alert("ডেমো: প্রোফাইল খুলবে")}>
                          👁️ দেখুন
                        </Button>
                        <Button variant="secondary" onClick={() => alert("ডেমো: ভেরিফিকেশন রিকোয়েস্ট গেল")}>
                          ✅ যাচাই
                        </Button>
                        <Button variant="danger" onClick={() => alert("ডেমো: ব্ল্যাকলিস্ট হবে")}>
                          🚫 ব্ল্যাকলিস্ট
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-[#6b7280]">
                      কোনো ডেটা পাওয়া যায়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination UI (demo) */}
        <div className="flex items-center justify-between mt-3 text-[12px] text-[#374151]">
          <div>পৃষ্ঠা: ১ / ৫ (ডেমো)</div>
          <div className="flex gap-2">
            <Button variant="secondary">⬅ পূর্ববর্তী</Button>
            <Button variant="secondary">পরবর্তী ➡</Button>
          </div>
        </div>
      </PortalSection>

      {/* Modal: Add Registration */}
      <Modal open={openAdd} title="নতুন উপকারভোগী নিবন্ধন" onClose={() => setOpenAdd(false)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[12px] mb-1 font-medium">
              উপকারভোগীর নাম <span className="text-red-500">*</span>
            </div>
            <input 
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none" 
              placeholder="নাম লিখুন" 
              required
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              পিতার নাম <span className="text-red-500">*</span>
            </div>
            <input 
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none" 
              placeholder="পিতার নাম লিখুন" 
              required
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              মাতার নাম <span className="text-red-500">*</span>
            </div>
            <input 
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none" 
              placeholder="মাতার নাম লিখুন" 
              required
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              উপকারভোগীর NID নম্বর <span className="text-red-500">*</span>
            </div>
            <input 
              type="text"
              maxLength={17}
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none" 
              placeholder="১০/১৩/১৭ ডিজিটের NID নম্বর" 
              required
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">বাবার NID নম্বর</div>
            <input 
              type="text"
              maxLength={17}
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none" 
              placeholder="বাবার NID নম্বর" 
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">মায়ের NID নম্বর</div>
            <input 
              type="text"
              maxLength={17}
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none" 
              placeholder="মায়ের NID নম্বর" 
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              জন্ম তারিখ <span className="text-red-500">*</span>
            </div>
            <input 
              type="date"
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none bg-white" 
              required
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              মোবাইল নম্বর <span className="text-red-500">*</span>
            </div>
            <input 
              type="tel"
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none" 
              placeholder="০১XXXXXXXXX" 
              required
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              মাসিক আয় (টাকা) <span className="text-red-500">*</span>
            </div>
            <input 
              type="number"
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none" 
              placeholder="মাসিক আয় লিখুন" 
              required
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              পরিবারের সদস্য সংখ্যা <span className="text-red-500">*</span>
            </div>
            <input 
              type="number"
              min="1"
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none" 
              placeholder="সদস্য সংখ্যা" 
              required
            />
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">
              ওয়ার্ড নম্বর <span className="text-red-500">*</span>
            </div>
            <select 
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none bg-white" 
              required
            >
              <option value="">নির্বাচন করুন</option>
              <option value="ওয়ার্ড-০১">ওয়ার্ড-০১</option>
              <option value="ওয়ার্ড-০২">ওয়ার্ড-০২</option>
              <option value="ওয়ার্ড-০৩">ওয়ার্ড-০৩</option>
              <option value="ওয়ার্ড-০৪">ওয়ার্ড-০৪</option>
              <option value="ওয়ার্ড-০৫">ওয়ার্ড-০৫</option>
            </select>
          </div>
          <div>
            <div className="text-[12px] mb-1 font-medium">স্ট্যাটাস</div>
            <select className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none bg-white">
              <option value="Inactive">Inactive (ডিফল্ট)</option>
              <option value="Active">Active (এডমিন অনুমোদন)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="text-[12px] mb-1 font-medium">
              বর্তমান ঠিকানা <span className="text-red-500">*</span>
            </div>
            <textarea 
              rows={2}
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none resize-none" 
              placeholder="সম্পূর্ণ ঠিকানা লিখুন (গ্রাম/মহল্লা, থানা, জেলা)" 
              required
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-[12px] mb-1 font-medium">মন্তব্য</div>
            <textarea 
              rows={2}
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] focus:ring-2 focus:ring-[#16679c] outline-none resize-none" 
              placeholder="অতিরিক্ত তথ্য (ঐচ্ছিক)" 
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setOpenAdd(false)}>
            বাতিল
          </Button>
          <Button onClick={() => {
            alert("ডেমো: নিবন্ধন সাবমিট হয়েছে");
            setOpenAdd(false);
          }}>
            সংরক্ষণ করুন
          </Button>
        </div>
      </Modal>
    </div>
  );
}
