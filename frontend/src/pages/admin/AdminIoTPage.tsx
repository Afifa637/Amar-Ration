import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  getIotWeightAlerts,
  acknowledgeIotWeightAlert,
  type IotWeightAlert,
} from "../../services/api";

function diffLabel(diffG: number) {
  if (diffG > 0) return `+${diffG}g (à¦¬à§‡à¦¶à¦¿)`;
  if (diffG < 0) return `${diffG}g (à¦•à¦®)`;
  return "0g";
}

function diffColor(diffG: number) {
  const abs = Math.abs(diffG);
  if (abs > 100) return "text-red-600 font-bold";
  if (abs > 30) return "text-orange-500 font-semibold";
  return "text-yellow-600";
}

export default function AdminIoTPage() {
  const [alerts, setAlerts] = useState<IotWeightAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const a = await getIotWeightAlerts({ limit: 50 });
      setAlerts(a);
    } catch {
      setError("à¦¡à§‡à¦Ÿà¦¾ à¦²à§‹à¦¡ à¦•à¦°à¦¤à§‡ à¦¸à¦®à¦¸à§à¦¯à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡à¥¤");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAck = async (id: string) => {
    try {
      const updated = await acknowledgeIotWeightAlert(id);
      setAlerts((prev) => prev.map((a) => (a._id === id ? updated : a)));
    } catch {
      // ignore
    }
  };

  const visibleAlerts = showAll ? alerts : alerts.filter((a) => !a.acknowledged);
  const unackCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-bold text-[#1f2d3d]">IoT à¦“à¦œà¦¨ à¦¸à§à¦•à§‡à¦² â€” à¦…à§à¦¯à¦¾à¦²à¦¾à¦°à§à¦Ÿ à¦²à¦—</h1>
      <p className="text-xs text-gray-500">
        à¦ªà§à¦°à¦¤à¦¿à¦Ÿà¦¿ à¦¡à¦¿à¦¸à§à¦Ÿà§à¦°à¦¿à¦¬à¦¿à¦‰à¦Ÿà¦°à§‡à¦° IoT à¦¡à¦¿à¦­à¦¾à¦‡à¦¸à§‡à¦° à¦“à¦œà¦¨ à¦Ÿà¦¾à¦°à§à¦—à§‡à¦Ÿ à¦¸à§‡à¦Ÿ à¦•à¦°à¦¤à§‡{" "}
        <a href="/admin/distribution" className="text-blue-600 underline">à¦¬à¦¿à¦¤à¦°à¦£ à¦ªà§ƒà¦·à§à¦ à¦¾à¦¯à¦¼</a>{" "}
        à¦¯à¦¾à¦¨ à¦à¦¬à¦‚ à¦¸à¦‚à¦¶à§à¦²à¦¿à¦·à§à¦Ÿ à¦¡à¦¿à¦¸à§à¦Ÿà§à¦°à¦¿à¦¬à¦¿à¦‰à¦Ÿà¦° à¦¸à¦¿à¦²à§‡à¦•à§à¦Ÿ à¦•à¦°à§à¦¨à¥¤
      </p>

      <SectionCard title={`à¦“à¦œà¦¨ à¦®à¦¿à¦¸à¦®à§à¦¯à¦¾à¦š à¦…à§à¦¯à¦¾à¦²à¦¾à¦°à§à¦Ÿ${unackCount > 0 ? ` (${unackCount} à¦¨à¦¤à§à¦¨)` : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs text-blue-600 hover:underline"
          >
            {loading ? "à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡..." : "à¦°à¦¿à¦«à§à¦°à§‡à¦¶"}
          </button>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-gray-500 hover:underline"
          >
            {showAll ? "à¦¶à§à¦§à§ à¦¨à¦¤à§à¦¨ à¦¦à§‡à¦–à¦¾à¦¨" : "à¦¸à¦¬ à¦¦à§‡à¦–à¦¾à¦¨"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

        {visibleAlerts.length === 0 ? (
          <p className="text-sm text-gray-400">à¦•à§‹à¦¨à§‹ à¦…à§à¦¯à¦¾à¦²à¦¾à¦°à§à¦Ÿ à¦¨à§‡à¦‡à¥¤</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-600">
                  <th className="px-3 py-2 text-left border-b">à¦¸à¦®à¦¯à¦¼</th>
                  <th className="px-3 py-2 text-left border-b">à¦ªà¦£à§à¦¯</th>
                  <th className="px-3 py-2 text-right border-b">à¦Ÿà¦¾à¦°à§à¦—à§‡à¦Ÿ</th>
                  <th className="px-3 py-2 text-right border-b">à¦ªà¦°à¦¿à¦®à¦¾à¦ª</th>
                  <th className="px-3 py-2 text-right border-b">à¦ªà¦¾à¦°à§à¦¥à¦•à§à¦¯</th>
                  <th className="px-3 py-2 text-left border-b">à¦¡à¦¿à¦­à¦¾à¦‡à¦¸</th>
                  <th className="px-3 py-2 text-left border-b">à¦…à§à¦¯à¦¾à¦•à¦¶à¦¨</th>
                </tr>
              </thead>
              <tbody>
                {visibleAlerts.map((alert) => (
                  <tr
                    key={alert._id}
                    className={`border-b ${alert.acknowledged ? "opacity-50" : "bg-red-50"}`}
                  >
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(alert.createdAt).toLocaleString("bn-BD")}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {alert.product} â€” {alert.productName}
                    </td>
                    <td className="px-3 py-2 text-right">{alert.expectedKg} kg</td>
                    <td className="px-3 py-2 text-right">{alert.measuredKg} kg</td>
                    <td className={`px-3 py-2 text-right ${diffColor(alert.diffG)}`}>
                      {diffLabel(alert.diffG)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{alert.deviceId}</td>
                    <td className="px-3 py-2">
                      {!alert.acknowledged ? (
                        <button
                          type="button"
                          onClick={() => void handleAck(alert._id)}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                        >
                          à¦¸à§à¦¬à§€à¦•à¦¾à¦° à¦•à¦°à§à¦¨
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">âœ“ à¦¦à§‡à¦–à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
