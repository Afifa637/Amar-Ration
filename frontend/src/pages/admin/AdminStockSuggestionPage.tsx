import { useEffect, useMemo, useState } from "react";
import {
  getSimpleStockSuggestion,
  getSystemStockSuggestion,
  getWardStockSuggestion,
  type StockItem,
  type StockSuggestionResult,
} from "../../services/api";

const STOCK_ITEMS: StockItem[] = ["চাল", "ডাল", "পেঁয়াজ"];

export default function AdminStockSuggestionPage() {
  const [simple, setSimple] = useState({ movingAverage: 0, suggestedStock: 0 });
  const [wardRows, setWardRows] = useState<StockSuggestionResult[]>([]);
  const [detail, setDetail] = useState<StockSuggestionResult | null>(null);
  const [division, setDivision] = useState("");
  const [ward, setWard] = useState("");
  const [union, setUnion] = useState("");
  const [item, setItem] = useState<"all" | StockItem>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trendArrow = useMemo(() => {
    if (!detail) return "→";
    if (detail.trend === "increasing") return "↑";
    if (detail.trend === "decreasing") return "↓";
    return "→";
  }, [detail]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSimpleStockSuggestion(
          item === "all" ? undefined : item,
        );
        setSimple({
          movingAverage: Number(data.movingAverage || 0),
          suggestedStock: Number(data.suggestedStock || 0),
        });
      } catch {
        // silent
      }
    };
    void load();
  }, [item]);

  const onLoadSystem = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getSystemStockSuggestion(
        item === "all" ? undefined : item,
      );
      setWardRows(data.wards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onLoadDetail = async () => {
    if (!division.trim() || !ward.trim()) {
      setError("ডিভিশন এবং ওয়ার্ড একসাথে নির্বাচন করুন");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await getWardStockSuggestion(
        division,
        ward,
        union || undefined,
        item === "all" ? undefined : item,
      );
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">স্টক পরামর্শ</h1>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="text-sm text-gray-500 mb-2">
          সামগ্রিক পরামর্শকৃত স্টক ({item === "all" ? "সকল আইটেম" : item})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <div className="text-xs text-gray-500">গড় বিতরণ (কেজি)</div>
            <div className="text-2xl font-bold text-gray-800">
              {simple.movingAverage.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">
              পরামর্শকৃত পরবর্তী অর্ডার (কেজি)
            </div>
            <div className="text-3xl font-bold text-purple-700">
              {simple.suggestedStock}
            </div>
          </div>
          <div className="text-sm text-gray-600">→ স্থিতিশীল</div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <select
            value={item}
            onChange={(e) => setItem(e.target.value as "all" | StockItem)}
            className="border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="all">সকল আইটেম</option>
            {STOCK_ITEMS.map((stockItem) => (
              <option key={stockItem} value={stockItem}>
                {stockItem}
              </option>
            ))}
          </select>

          <button
            onClick={() => void onLoadSystem()}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
          >
            সব ওয়ার্ডের বিশ্লেষণ দেখুন
          </button>
        </div>

        {wardRows.length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    বিভাগ
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    ওয়ার্ড
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    ইউনিয়ন
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    আইটেম
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    গড় (কেজি)
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    পরামর্শ (কেজি)
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    প্রবণতা
                  </th>
                </tr>
              </thead>
              <tbody>
                {wardRows.map((row, idx) => (
                  <tr
                    key={`${row.ward}-${idx}`}
                    className="border-t border-gray-100"
                  >
                    <td className="p-2 text-sm">{row.division || "—"}</td>
                    <td className="p-2 text-sm">{row.ward}</td>
                    <td className="p-2 text-sm">{row.union}</td>
                    <td className="p-2 text-sm">{row.item || "all"}</td>
                    <td className="p-2 text-sm">{row.movingAverage}</td>
                    <td className="p-2 text-sm font-semibold text-purple-700">
                      {row.suggestedStock}
                    </td>
                    <td className="p-2 text-sm">
                      {row.trend === "increasing" && (
                        <span className="text-green-700">↑ বাড়ছে</span>
                      )}
                      {row.trend === "decreasing" && (
                        <span className="text-red-700">↓ কমছে</span>
                      )}
                      {row.trend === "stable" && (
                        <span className="text-gray-600">→ স্থিতিশীল</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
            placeholder="বিভাগ (যেমন: Dhaka)"
          />
          <input
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
            placeholder="ওয়ার্ড নম্বর"
          />
          <input
            value={union}
            onChange={(e) => setUnion(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
            placeholder="ইউনিয়ন নাম"
          />
          <button
            onClick={() => void onLoadDetail()}
            className="md:col-span-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
          >
            এই বিভাগ+ওয়ার্ড বিশ্লেষণ
          </button>
        </div>

        {detail && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-gray-700">
              আইটেম:{" "}
              <span className="font-semibold">{detail.item || "all"}</span>
            </div>
            <div className="text-sm text-gray-700">
              প্রবণতা:{" "}
              <span className="font-semibold">
                {trendArrow} {detail.trendBangla}
              </span>
            </div>
            <div className="text-xs text-gray-500">{detail.note}</div>
            <div className="space-y-2">
              {detail.last3Sessions.map((s) => {
                const width =
                  detail.suggestedStock > 0
                    ? Math.max(
                        10,
                        Math.round((s.totalKg / detail.suggestedStock) * 100),
                      )
                    : 10;
                return (
                  <div key={s.sessionId}>
                    <div className="text-xs text-gray-600">সেশন {s.date}</div>
                    <div className="h-6 bg-gray-100 rounded-lg overflow-hidden mt-1 relative">
                      <div
                        className="h-full bg-purple-400"
                        style={{ width: `${Math.min(100, width)}%` }}
                      />
                      <span className="absolute right-2 top-1 text-xs text-gray-700">
                        {s.totalKg} kg
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-sm text-gray-500 mt-3">লোড হচ্ছে...</div>
        )}
      </section>
    </div>
  );
}
