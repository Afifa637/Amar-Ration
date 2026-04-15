import { useEffect, useMemo, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import ArRationCardView from "../../components/cards/ArRationCardView";
import { buildArRationCardPrintHtml } from "../../components/cards/arRationCardPrint";
import {
  getConsumerCard,
  getConsumerCards,
  type ConsumerCardDetail,
  type ConsumerCardRow,
} from "../../services/api";

function cardStatusBn(status: ConsumerCardRow["cardStatus"]) {
  if (status === "Active") return "সক্রিয়";
  if (status === "Revoked") return "বাতিল";
  return "নিষ্ক্রিয়";
}

function qrStatusBn(status: ConsumerCardRow["qrStatus"]) {
  if (status === "Valid") return "বৈধ";
  if (status === "Revoked") return "বাতিল";
  if (status === "Expired") return "মেয়াদোত্তীর্ণ";
  return "অবৈধ";
}

export default function CardsTokensPage() {
  const [cards, setCards] = useState<ConsumerCardRow[]>([]);
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("");
  const [ward, setWard] = useState("");
  const [cardStatus, setCardStatus] = useState<
    "সব" | "Active" | "Inactive" | "Revoked"
  >("সব");
  const [message] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [openCard, setOpenCard] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ConsumerCardDetail | null>(
    null,
  );

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const cardData = await getConsumerCards({ limit: 300 });
      setCards(cardData.rows || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "কার্ড ডেটা লোড ব্যর্থ হয়েছে",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const divisionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          cards.map((card) => (card.division || "").trim()).filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "bn")),
    [cards],
  );

  const wardOptions = useMemo(
    () =>
      Array.from(
        new Set(
          cards
            .filter((card) =>
              division ? (card.division || "") === division : true,
            )
            .map((card) => (card.ward || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "bn")),
    [cards, division],
  );

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchSearch =
        !search.trim() ||
        card.consumerCode.toLowerCase().includes(search.toLowerCase()) ||
        card.name?.toLowerCase().includes(search.toLowerCase()) ||
        (card.ward || "").toLowerCase().includes(search.toLowerCase());

      const matchStatus = cardStatus === "সব" || card.cardStatus === cardStatus;
      const matchDivision = !division || (card.division || "") === division;
      const matchWard = !ward || (card.ward || "") === ward;

      return matchSearch && matchStatus && matchDivision && matchWard;
    });
  }, [cards, search, cardStatus, division, ward]);

  const stats = useMemo(() => {
    const total = filteredCards.length;
    const active = filteredCards.filter(
      (card) => card.cardStatus === "Active",
    ).length;
    const validQr = filteredCards.filter(
      (card) => card.qrStatus === "Valid",
    ).length;
    const due = filteredCards.filter((card) => {
      if (!card.validTo) return false;
      return Date.now() > new Date(card.validTo).getTime();
    }).length;
    return { total, active, validQr, due };
  }, [filteredCards]);

  const openCardPreview = async (consumerId: string) => {
    try {
      setLoading(true);
      setError("");
      const card = await getConsumerCard(consumerId);
      setSelectedCard(card);
      setOpenCard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "কার্ড লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const printCard = (card: ConsumerCardDetail) => {
    const win = window.open("", "_blank", "width=980,height=760");
    if (!win) return;
    win.document.write(buildArRationCardPrintHtml(card));
    win.document.close();
  };

  return (
    <div className="space-y-3">
      <PortalSection
        title="আমার রেশন কার্ড ব্যবস্থাপনা"
        right={
          <Button variant="secondary" onClick={() => void loadData()}>
            🔄 রিফ্রেশ
          </Button>
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
          <div className="border rounded p-2 text-[12px]">
            মোট কার্ড: <b>{stats.total}</b>
          </div>
          <div className="border rounded p-2 bg-[#ecfdf5] text-[12px]">
            সক্রিয় কার্ড: <b>{stats.active}</b>
          </div>
          <div className="border rounded p-2 bg-[#eff6ff] text-[12px]">
            বৈধ কিউআর: <b>{stats.validQr}</b>
          </div>
          <div className="border rounded p-2 bg-[#fffbeb] text-[12px]">
            মেয়াদোত্তীর্ণ: <b>{stats.due}</b>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="সার্চ: কোড / নাম / ওয়ার্ড"
          />
          <select
            value={division}
            onChange={(e) => {
              setDivision(e.target.value);
              setWard("");
            }}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">সব বিভাগ</option>
            {divisionOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">সব ওয়ার্ড</option>
            {wardOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
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
            <option value="Active">সক্রিয়</option>
            <option value="Inactive">নিষ্ক্রিয়</option>
            <option value="Revoked">বাতিল</option>
          </select>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setDivision("");
              setWard("");
              setCardStatus("সব");
            }}
          >
            রিসেট
          </Button>
        </div>

        <div className="border border-[#cfd6e0] rounded overflow-hidden">
          <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
            আমার রেশন কার্ড তালিকা
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-250 text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="border border-[#cfd6e0] p-2">কোড</th>
                  <th className="border border-[#cfd6e0] p-2">নাম</th>
                  <th className="border border-[#cfd6e0] p-2">বিভাগ</th>
                  <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                  <th className="border border-[#cfd6e0] p-2">ক্যাটাগরি</th>
                  <th className="border border-[#cfd6e0] p-2">কার্ড</th>
                  <th className="border border-[#cfd6e0] p-2">কিউআর</th>
                  <th className="border border-[#cfd6e0] p-2">মেয়াদ</th>
                  <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((card) => (
                  <tr
                    key={card.consumerId}
                    className="odd:bg-white even:bg-[#f8fafc]"
                  >
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {card.consumerCode}
                    </td>
                    <td className="border border-[#cfd6e0] p-2">{card.name}</td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {card.division || "—"}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {card.ward || "—"}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {card.category}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      <Badge
                        tone={
                          card.cardStatus === "Active"
                            ? "green"
                            : card.cardStatus === "Revoked"
                              ? "red"
                              : "yellow"
                        }
                      >
                        {cardStatusBn(card.cardStatus)}
                      </Badge>
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      <Badge
                        tone={
                          card.qrStatus === "Valid"
                            ? "green"
                            : card.qrStatus === "Revoked"
                              ? "red"
                              : "yellow"
                        }
                      >
                        {qrStatusBn(card.qrStatus)}
                      </Badge>
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {card.validTo
                        ? new Date(card.validTo).toLocaleDateString("bn-BD")
                        : "—"}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      <Button
                        variant="secondary"
                        onClick={() => void openCardPreview(card.consumerId)}
                      >
                        👁️ দেখুন/প্রিন্ট
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredCards.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-[#6b7280]">
                      {loading ? "লোড হচ্ছে..." : "কোনো কার্ড ডেটা নেই"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PortalSection>

      <Modal
        open={openCard}
        title="আমার রেশন কার্ড প্রিভিউ"
        onClose={() => setOpenCard(false)}
      >
        <div className="space-y-3">
          <ArRationCardView card={selectedCard} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCard(false)}>
              বন্ধ
            </Button>
            <Button
              onClick={() => selectedCard && printCard(selectedCard)}
              disabled={!selectedCard}
            >
              🖨️ কার্ড প্রিন্ট/পিডিএফ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
