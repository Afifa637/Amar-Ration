import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  deleteConsumerCard,
  getConsumerCard,
  getConsumerCards,
  getAdminCardsSummary,
  reissueConsumerCard,
  type AdminCardsSummary,
  type ConsumerCardDetail,
  type ConsumerCardRow,
} from "../../services/api";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

export default function AdminCardsPage() {
  const [summary, setSummary] = useState<AdminCardsSummary | null>(null);
  const [cards, setCards] = useState<ConsumerCardRow[]>([]);
  const [search, setSearch] = useState("");
  const [cardStatus, setCardStatus] = useState<
    "সব" | "Active" | "Inactive" | "Revoked"
  >("সব");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openCard, setOpenCard] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ConsumerCardDetail | null>(
    null,
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, cardData] = await Promise.all([
        getAdminCardsSummary(),
        getConsumerCards({ limit: 300 }),
      ]);
      setSummary(summaryData);
      setCards(cardData.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "কার্ড ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchSearch =
        !search.trim() ||
        card.consumerCode.toLowerCase().includes(search.toLowerCase()) ||
        card.name.toLowerCase().includes(search.toLowerCase()) ||
        (card.ward || "").toLowerCase().includes(search.toLowerCase());

      const matchStatus = cardStatus === "সব" || card.cardStatus === cardStatus;

      return matchSearch && matchStatus;
    });
  }, [cards, search, cardStatus]);

  const openCardPreview = async (consumerId: string) => {
    try {
      setLoading(true);
      const card = await getConsumerCard(consumerId);
      setSelectedCard(card);
      setOpenCard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "কার্ড লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onReissue = async (consumerId: string) => {
    const confirmed = window.confirm("এই কনজিউমারের QR পুনরায় ইস্যু করবেন?");
    if (!confirmed) return;

    try {
      setLoading(true);
      setError("");
      const result = await reissueConsumerCard(consumerId);
      setMessage(`QR রিইস্যু সফল: ${result.consumerCode}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR রিইস্যু ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onRemoveCard = async (consumerId: string) => {
    const confirmed = window.confirm(
      "এই OMS কার্ড মুছে ফেলতে চান? এই অ্যাকশনে কার্ড কাউন্ট আপডেট হবে।",
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      setError("");
      const result = await deleteConsumerCard(consumerId);
      setMessage(`কার্ড অপসারণ সফল: ${result.consumerCode}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "কার্ড অপসারণ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const statusText = (status?: string) => {
    if (status === "Active" || status === "Valid") return "সক্রিয়";
    if (status === "Inactive" || status === "Invalid") return "নিষ্ক্রিয়";
    if (status === "Revoked") return "বাতিল";
    if (status === "Expired") return "মেয়াদোত্তীর্ণ";
    return status || "—";
  };

  const printCard = (card: ConsumerCardDetail) => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const validToText = card.validTo
      ? new Date(card.validTo).toLocaleDateString("bn-BD")
      : "—";

    win.document.write(`
      <html>
        <head>
          <title>OMS Card - ${card.consumerCode}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; }
            .card { width: 720px; border: 2px solid #0f4c75; border-radius: 12px; padding: 20px; }
            .title { font-size: 28px; font-weight: 700; color: #0f4c75; }
            .grid { display: grid; grid-template-columns: 1fr 220px; gap: 16px; margin-top: 14px; }
            .kv { margin-bottom: 8px; font-size: 14px; }
            .qr { text-align: center; border: 1px solid #dbe3ef; border-radius: 10px; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">আমার রেশন — OMS কার্ড</div>
            <div class="grid">
              <div>
                <div class="kv"><b>Consumer Code:</b> ${card.consumerCode}</div>
                <div class="kv"><b>নাম:</b> ${card.name}</div>
                <div class="kv"><b>ক্যাটাগরি:</b> ${card.category}</div>
                <div class="kv"><b>ওয়ার্ড:</b> ${card.ward || "—"}</div>
                <div class="kv"><b>কার্ড:</b> ${card.cardStatus}</div>
                <div class="kv"><b>QR:</b> ${card.qrStatus}</div>
                <div class="kv"><b>Valid To:</b> ${validToText}</div>
              </div>
              <div class="qr">
                ${card.qrImageDataUrl ? `<img src="${card.qrImageDataUrl}" width="200" height="200" alt="QR" />` : "QR unavailable"}
              </div>
            </div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> OMS কার্ড ও QR কন্ট্রোল
      </div>

      <SectionCard title="QR কার্ড কন্ট্রোল সারাংশ">
        {(error || message) && (
          <div
            className={`mb-3 text-[12px] px-3 py-2 rounded border ${error ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]" : "bg-[#ecfdf3] border-[#86efac] text-[#166534]"}`}
          >
            {error || message}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["ইস্যুকৃত কার্ড", String(summary?.issuedCards ?? 0)],
            ["সক্রিয় কার্ড", String(summary?.activeCards ?? 0)],
            ["সক্রিয় QR", String(summary?.validQR ?? summary?.activeQR ?? 0)],
            [
              "নিষ্ক্রিয়/বাতিল QR",
              String(
                summary?.revokedOrInvalidQR ?? summary?.inactiveRevoked ?? 0,
              ),
            ],
            ["রোটেশনের জন্য বাকি", String(summary?.dueForRotation ?? 0)],
            ["অপসারিত কার্ড", String(summary?.removedCards ?? 0)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]"
            >
              <div className="text-sm text-[#6b7280]">{label}</div>
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

      <SectionCard title="কার্ড তালিকা ও প্রিন্ট ভিউ">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="সার্চ: consumer code / নাম / ওয়ার্ড"
          />
          <select
            value={cardStatus}
            onChange={(e) =>
              setCardStatus(
                e.target.value as "সব" | "Active" | "Inactive" | "Revoked",
              )
            }
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="সব">সব কার্ড স্ট্যাটাস</option>
            <option value="Active">সক্রিয়</option>
            <option value="Inactive">নিষ্ক্রিয়</option>
            <option value="Revoked">বাতিল</option>
          </select>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void load()}>
              🔄 রিফ্রেশ
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setCardStatus("সব");
              }}
            >
              রিসেট
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "কোড",
                  "নাম",
                  "ওয়ার্ড",
                  "কার্ড",
                  "QR",
                  "মেয়াদ",
                  "অ্যাকশন",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCards.map((card) => (
                <tr
                  key={card.consumerId}
                  className="odd:bg-white even:bg-[#fafbfc]"
                >
                  <td className="p-2 border border-[#d7dde6]">
                    {card.consumerCode}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{card.name}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {card.ward || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    <Badge
                      tone={
                        card.cardStatus === "Active"
                          ? "green"
                          : card.cardStatus === "Revoked"
                            ? "red"
                            : "yellow"
                      }
                    >
                      {statusText(card.cardStatus)}
                    </Badge>
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    <Badge
                      tone={
                        card.qrStatus === "Valid"
                          ? "green"
                          : card.qrStatus === "Revoked"
                            ? "red"
                            : "yellow"
                      }
                    >
                      {statusText(card.qrStatus)}
                    </Badge>
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {card.validTo
                      ? new Date(card.validTo).toLocaleDateString("bn-BD")
                      : "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        onClick={() => void openCardPreview(card.consumerId)}
                      >
                        👁️
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void onReissue(card.consumerId)}
                      >
                        ♻️
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void onRemoveCard(card.consumerId)}
                      >
                        🗑️
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCards.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-3 text-center text-[#6b7280]">
                    {loading ? "লোড হচ্ছে..." : "কোনো কার্ড ডেটা নেই"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="QR লাইফসাইকেল নীতি">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                <th className="p-2 border border-[#d7dde6]">অবস্থা</th>
                <th className="p-2 border border-[#d7dde6]">অর্থ</th>
                <th className="p-2 border border-[#d7dde6]">স্ক্যান ফলাফল</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "সক্রিয়",
                  "যাচাইকৃত উপকারভোগী বিতরণে অংশ নিতে পারে",
                  "টোকেন ইস্যু হবে",
                ],
                ["নিষ্ক্রিয়", "সাময়িকভাবে ব্লক/অঅনুমোদিত", "স্ক্যান বাতিল"],
                [
                  "বাতিল",
                  "অ্যাডমিন অ্যাকশনে কার্ড বাতিল",
                  "স্ক্যান বাতিল + লগ",
                ],
                ["মেয়াদোত্তীর্ণ", "রোটেশন সময় অতিক্রান্ত", "নতুন QR প্রয়োজন"],
              ].map((row) => (
                <tr key={row[0]} className="odd:bg-white even:bg-[#fafbfc]">
                  {row.map((cell) => (
                    <td key={cell} className="p-2 border border-[#d7dde6]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="অ্যাডমিন অ্যাকশন">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• যাচাই সফল হলে OMS রেশন কার্ড ইস্যু।</li>
          <li>• নিষ্ক্রিয় অনুমোদনের পর QR সঙ্গে সঙ্গে বাতিল।</li>
          <li>• নির্ধারিত সময় অনুযায়ী QR রোটেশন।</li>
          <li>• প্রতিটি QR স্টেট পরিবর্তন অডিটে নথিভুক্ত।</li>
        </ul>
      </SectionCard>

      <Modal
        open={openCard}
        title="কার্ড প্রিভিউ"
        onClose={() => setOpenCard(false)}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div>
              কোড: <b>{selectedCard?.consumerCode}</b>
            </div>
            <div>
              নাম: <b>{selectedCard?.name}</b>
            </div>
            <div>
              ওয়ার্ড: <b>{selectedCard?.ward || "—"}</b>
            </div>
            <div>
              ক্যাটাগরি: <b>{selectedCard?.category}</b>
            </div>
            <div>
              কার্ড: <b>{selectedCard?.cardStatus}</b>
            </div>
            <div>
              QR: <b>{selectedCard?.qrStatus}</b>
            </div>
          </div>
          <div className="border rounded p-2 flex justify-center bg-[#f8fafc]">
            {selectedCard?.qrImageDataUrl ? (
              <img
                src={selectedCard.qrImageDataUrl}
                alt="QR"
                className="w-44 h-44"
              />
            ) : (
              <div className="text-[12px] text-[#6b7280]">QR unavailable</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCard(false)}>
              বন্ধ
            </Button>
            <Button
              onClick={() => selectedCard && printCard(selectedCard)}
              disabled={!selectedCard}
            >
              🖨️ প্রিন্ট/PDF
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
