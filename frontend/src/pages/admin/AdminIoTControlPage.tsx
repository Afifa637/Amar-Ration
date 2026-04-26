import { useState, useEffect } from "react";
import SectionCard from "../../components/SectionCard";
import {
  getAdminDistributors,
  getIotProductTargets,
  setIotProductTargets,
  pushTargetsToEsp32,
  type AdminDistributorRow,
} from "../../services/api";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_API_KEY = "amar_ration_iot_device_key_2026";
const PRODUCT_NAMES: [string, string, string] = ["চাল", "ডাল", "পেঁয়াজ"];

const parseKg = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) || n < 0 ? 0 : n;
};

// ─── DBMS Suggestions Data ───────────────────────────────────────────────────

const DBMS_SUGGESTIONS = [
  {
    icon: "🗂️",
    title: "ইন্ডেক্স অপ্টিমাইজেশন",
    items: [
      "IotWeightAlert কালেকশনে `distributorId` ও `createdAt` ফিল্ডে compound index যোগ করুন।",
      "DistributionRecord-এ `consumerId + distributionDate` এ compound index রাখুন — query ২০x পর্যন্ত দ্রুত হবে।",
      "Token কালেকশনে `status + distributorId` ইন্ডেক্স রাখুন active token query-তে।",
    ],
  },
  {
    icon: "🗃️",
    title: "ডেটা আর্কাইভিং কৌশল",
    items: [
      "৬ মাসের পুরানো IotWeightAlert রেকর্ড একটি আলাদা archive collection-এ সরিয়ে নিন।",
      "পুরানো DistributionRecord MongoDB TTL Index দিয়ে auto-expire করুন (e.g., ২ বছর)।",
      "মাসিক ভিত্তিতে DistributionRecord aggregate করে একটি MonthlySummary কালেকশনে সেভ করুন।",
    ],
  },
  {
    icon: "💾",
    title: "ব্যাকআপ পরিকল্পনা",
    items: [
      "MongoDB Atlas Automated Backup চালু রাখুন — প্রতিদিন একটি snapshot নিন।",
      "প্রতি সপ্তাহে mongodump দিয়ে সম্পূর্ণ DB export করে নিরাপদ স্থানে রাখুন।",
      "Critical কালেকশন (User, Consumer, OMSCard) এর জন্য Point-in-Time Recovery চালু রাখুন।",
    ],
  },
  {
    icon: "📊",
    title: "পারফরম্যান্স মনিটরিং",
    items: [
      "MongoDB Atlas Performance Advisor ব্যবহার করুন slow query চিহ্নিত করতে।",
      "Render.com এর memory/CPU ড্যাশবোর্ড নিয়মিত দেখুন — peak load-এ horizontal scaling বিবেচনা করুন।",
      "API response time লগ করুন — ৫০০ms এর বেশি হলে index বা query optimize করুন।",
    ],
  },
  {
    icon: "🔒",
    title: "ডেটা নিরাপত্তা",
    items: [
      "Production DB-তে IP whitelist চালু রাখুন — শুধু Render.com IP অনুমোদন করুন।",
      "Sensitive field (NID, phone) গুলো AES-256 দিয়ে encrypt করে সংরক্ষণ করুন।",
      "Audit log কালেকশন read-only user দিয়ে সীমাবদ্ধ রাখুন — শুধু append করা যাবে।",
    ],
  },
  {
    icon: "⚡",
    title: "IoT ডেটা ব্যবস্থাপনা",
    items: [
      "IotWeightAlert-এ প্রতিদিনের aggregation চালিয়ে DailySummary কালেকশন তৈরি করুন।",
      "যে ESP32 ডিভাইসগুলো ৩০ দিনেরও বেশি inactive, তাদের automatically deregister করুন।",
      "Weight reading data time-series collection হিসেবে store করলে MongoDB time-series অপ্টিমাইজেশন পাবেন।",
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminIoTControlPage() {
  // Distributor list + selection
  const [distributors, setDistributors] = useState<AdminDistributorRow[]>([]);
  const [selectedDistId, setSelectedDistId] = useState<string>("");

  // Product weight form values (controlled as strings)
  const [p1Kg, setP1Kg] = useState("1.500");
  const [p2Kg, setP2Kg] = useState("0.750");
  const [p3Kg, setP3Kg] = useState("1.000");

  // DB save feedback
  const [dbSaving, setDbSaving] = useState(false);
  const [dbMessage, setDbMessage] = useState("");
  const [dbError, setDbError] = useState("");

  // ESP32 push config + feedback
  const [esp32Url, setEsp32Url] = useState("http://192.168.4.1");
  const [esp32ApiKey, setEsp32ApiKey] = useState(DEFAULT_API_KEY);
  const [espPushing, setEspPushing] = useState(false);
  const [espMessage, setEspMessage] = useState("");
  const [espError, setEspError] = useState("");

  // Load active distributors on mount
  useEffect(() => {
    const load = async () => {
      try {
        const result = await getAdminDistributors({ status: "Active" });
        setDistributors(result.rows);
        const first = result.rows[0];
        if (first?.distributorId) {
          setSelectedDistId(first.distributorId);
        }
      } catch {
        // silently ignore — UI will show empty select
      }
    };
    void load();
  }, []);

  // Reload targets whenever selected distributor changes
  useEffect(() => {
    const load = async () => {
      try {
        const targets = await getIotProductTargets(selectedDistId || undefined);
        setP1Kg(targets.p1Kg.toFixed(3));
        setP2Kg(targets.p2Kg.toFixed(3));
        setP3Kg(targets.p3Kg.toFixed(3));
      } catch {
        // Keep current form values on error
      }
    };
    void load();
  }, [selectedDistId]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSaveToDb = async () => {
    setDbSaving(true);
    setDbMessage("");
    setDbError("");
    try {
      await setIotProductTargets(
        {
          p1Kg: parseKg(p1Kg),
          p2Kg: parseKg(p2Kg),
          p3Kg: parseKg(p3Kg),
          productNames: PRODUCT_NAMES,
        },
        selectedDistId || undefined,
      );
      setDbMessage(
        "✅ সফলভাবে ব্যাকএন্ড DB-তে সেভ হয়েছে! ESP32 পরবর্তী বুট বা sync-এ এই মান স্বয়ংক্রিয়ভাবে নেবে।",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "অজানা ত্রুটি ঘটেছে";
      setDbError(`❌ সেভ করতে ব্যর্থ হয়েছে: ${msg}`);
    } finally {
      setDbSaving(false);
    }
  };

  const handlePushToEsp32 = async () => {
    if (!esp32Url.startsWith("http://") && !esp32Url.startsWith("https://")) {
      setEspError(
        "❌ ESP32 URL অবশ্যই http:// বা https:// দিয়ে শুরু হতে হবে।",
      );
      return;
    }
    setEspPushing(true);
    setEspMessage("");
    setEspError("");
    try {
      const result = await pushTargetsToEsp32(esp32Url, esp32ApiKey, {
        p1Kg: parseKg(p1Kg),
        p2Kg: parseKg(p2Kg),
        p3Kg: parseKg(p3Kg),
      });
      setEspMessage(
        `✅ ESP32 সফলভাবে আপডেট হয়েছে! ডিভাইস নিশ্চিত করেছে — P1: ${result.p1Kg} kg, P2: ${result.p2Kg} kg, P3: ${result.p3Kg} kg।`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "অজানা ত্রুটি ঘটেছে";
      setEspError(
        `❌ ESP32-এ পাঠাতে ব্যর্থ হয়েছে: ${msg} — নিশ্চিত করুন ব্রাউজার ও ডিভাইস একই নেটওয়ার্কে আছে।`,
      );
    } finally {
      setEspPushing(false);
    }
  };

  // ── Product card config ─────────────────────────────────────────────────────

  const productCards: {
    key: string;
    label: string;
    badge: string;
    value: string;
    setValue: (v: string) => void;
    cardCls: string;
    badgeCls: string;
  }[] = [
    {
      key: "p1",
      label: "চাল (Rice)",
      badge: "P1",
      value: p1Kg,
      setValue: setP1Kg,
      cardCls: "bg-amber-50 border-amber-200",
      badgeCls: "bg-amber-500",
    },
    {
      key: "p2",
      label: "ডাল (Lentil)",
      badge: "P2",
      value: p2Kg,
      setValue: setP2Kg,
      cardCls: "bg-green-50 border-green-200",
      badgeCls: "bg-green-600",
    },
    {
      key: "p3",
      label: "পেঁয়াজ (Onion)",
      badge: "P3",
      value: p3Kg,
      setValue: setP3Kg,
      cardCls: "bg-purple-50 border-purple-200",
      badgeCls: "bg-purple-600",
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-[18px] font-bold text-[#1f2d3d]">
          IoT ডিভাইস কন্ট্রোল প্যানেল
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          ESP32 স্মার্ট ওজন স্কেলের পণ্য-লক্ষ্যমাত্রা নির্ধারণ করুন — ব্যাকএন্ড
          DB-তে সেভ করুন অথবা ডিভাইসে সরাসরি push করুন।
        </p>
      </div>

      {/* ── Card 1: Product Target Form ──────────────────────────────────────── */}
      <SectionCard title="পণ্যের লক্ষ্যমাত্রা সেট করুন">
        <div className="space-y-4">
          {/* Distributor select */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              ডিস্ট্রিবিউটর নির্বাচন করুন
            </label>
            <select
              value={selectedDistId}
              onChange={(e) => setSelectedDistId(e.target.value)}
              className="w-full sm:w-72 border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">— সকল (গ্লোবাল) —</option>
              {distributors.map((d) => (
                <option key={d.userId} value={d.distributorId ?? ""}>
                  {d.name}
                  {d.wardNo ? ` (ওয়ার্ড ${d.wardNo})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Product weight cards – 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {productCards.map((card) => (
              <div
                key={card.key}
                className={`border rounded-lg p-4 ${card.cardCls}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold flex-shrink-0 ${card.badgeCls}`}
                  >
                    {card.badge}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {card.label}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={card.value}
                  onChange={(e) => card.setValue(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-gray-500 mt-1">কেজি (Kg)</p>
              </div>
            ))}
          </div>

          {/* Save button + note */}
          <div>
            <button
              type="button"
              onClick={() => void handleSaveToDb()}
              disabled={dbSaving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {dbSaving ? "সেভ হচ্ছে…" : "💾 ব্যাকএন্ড DB-তে সেভ করুন"}
            </button>
            <p className="text-xs text-gray-400 mt-1.5">
              ESP32 ডিভাইস পরবর্তী বুট বা sync-এ এই মান স্বয়ংক্রিয়ভাবে নেবে।
            </p>
          </div>

          {/* DB feedback messages */}
          {dbMessage && (
            <div className="rounded px-3 py-2 text-sm bg-green-50 text-green-700 border border-green-200">
              {dbMessage}
            </div>
          )}
          {dbError && (
            <div className="rounded px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
              {dbError}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Card 2: ESP32 Direct Push ─────────────────────────────────────────── */}
      <SectionCard title="ESP32 ডিভাইসে সরাসরি পাঠান">
        <div className="space-y-4">
          {/* Intro paragraph */}
          <p className="text-xs text-gray-500">
            এই ফিচারটি ব্যবহার করতে ব্রাউজার ও ESP32 ডিভাইসকে একই নেটওয়ার্কে
            থাকতে হবে (যেমন: AP Mode বা Local Wi-Fi)। ব্রাউজার সরাসরি ডিভাইসের
            HTTP endpoint-এ POST request পাঠাবে।
          </p>

          {/* URL + API Key grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                ESP32 ডিভাইসের URL / IP
              </label>
              <input
                type="text"
                value={esp32Url}
                onChange={(e) => setEsp32Url(e.target.value)}
                placeholder="http://192.168.4.1"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                AP Mode ডিফল্ট: http://192.168.4.1
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                IoT API Key
              </label>
              <input
                type="text"
                value={esp32ApiKey}
                onChange={(e) => setEsp32ApiKey(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Live JSON preview */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">
              📤 পাঠানো হবে — Live JSON Preview
            </p>
            <div className="bg-[#1e2a3a] rounded-lg p-4 font-mono text-xs leading-relaxed select-all">
              <span className="text-gray-400">{"{"}</span>
              <br />
              <span className="text-gray-500 pl-4">&quot;p1Kg&quot;: </span>
              <span className="text-amber-400">{parseKg(p1Kg)}</span>
              <span className="text-gray-500">,</span>
              <br />
              <span className="text-gray-500 pl-4">&quot;p2Kg&quot;: </span>
              <span className="text-green-400">{parseKg(p2Kg)}</span>
              <span className="text-gray-500">,</span>
              <br />
              <span className="text-gray-500 pl-4">&quot;p3Kg&quot;: </span>
              <span className="text-purple-400">{parseKg(p3Kg)}</span>
              <br />
              <span className="text-gray-400">{"}"}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              POST →{" "}
              <span className="font-mono">
                {esp32Url.replace(/\/+$/, "")}/set-targets
              </span>
            </p>
          </div>

          {/* Push button */}
          <div>
            <button
              type="button"
              onClick={() => void handlePushToEsp32()}
              disabled={espPushing}
              className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {espPushing ? "পাঠানো হচ্ছে…" : "🔌 ESP32-এ এখনই পাঠান"}
            </button>
          </div>

          {/* ESP32 feedback messages */}
          {espMessage && (
            <div className="rounded px-3 py-2 text-sm bg-green-50 text-green-700 border border-green-200">
              {espMessage}
            </div>
          )}
          {espError && (
            <div className="rounded px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
              {espError}
            </div>
          )}

          {/* Prerequisites warning box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-yellow-800 mb-2">
              ⚠️ পূর্বশর্ত (Prerequisites):
            </p>
            <ul className="space-y-2">
              {[
                "ব্রাউজার ও ESP32 একই নেটওয়ার্কে থাকতে হবে (AP Mode বা Local Wi-Fi)।",
                "ESP32 ফার্মওয়্যারে CORS সাপোর্ট থাকতে হবে (সর্বশেষ firmware ব্যবহার করুন)।",
                "HTTPS পেজ থেকে HTTP ডিভাইসে কল করলে ব্রাউজার Mixed Content ব্লক করতে পারে।",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-yellow-700">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-200 text-yellow-800 font-bold flex-shrink-0 mt-0.5 text-[10px]">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      {/* ── Card 3: DBMS Suggestions ──────────────────────────────────────────── */}
      <SectionCard title="DBMS ব্যবস্থাপনা পরামর্শ (MongoDB)">
        <div className="space-y-4">
          {/* Suggestion grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DBMS_SUGGESTIONS.map((suggestion) => (
              <div
                key={suggestion.title}
                className="border border-gray-100 rounded-lg p-4 bg-gray-50"
              >
                <p className="text-sm font-semibold text-[#1f2d3d] mb-2">
                  {suggestion.icon} {suggestion.title}
                </p>
                <ul className="space-y-2">
                  {suggestion.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-gray-600"
                    >
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 font-bold flex-shrink-0 mt-0.5 text-[10px]">
                        {idx + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Recommended index commands */}
          <div className="bg-[#1e2a3a] rounded-lg p-4">
            <pre className="text-xs text-green-300 overflow-x-auto whitespace-pre-wrap">{`// পরামর্শকৃত MongoDB Indexes (mongosh)
db.iotweightalerts.createIndex({ distributorId: 1, createdAt: -1 });
db.distributionrecords.createIndex({ consumerId: 1, distributionDate: -1 });
db.tokens.createIndex({ status: 1, distributorId: 1 });
db.auditlogs.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 63072000 }  // 2 years TTL
);`}</pre>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
