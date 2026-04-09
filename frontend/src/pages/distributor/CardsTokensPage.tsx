import { useEffect, useMemo, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import {
  cancelDistributionToken,
  getConsumerCard,
  getConsumerCards,
  getDistributionStats,
  getDistributionTokens,
  issueToken,
  type ConsumerCardDetail,
  type ConsumerCardRow,
  type DistributionToken,
  type TokenStatus,
} from "../../services/api";

const statusTone: Record<TokenStatus, "blue" | "green" | "red" | "yellow"> = {
  Issued: "blue",
  Used: "green",
  Cancelled: "red",
  Expired: "yellow",
};

function tokenStatusLabel(status: TokenStatus): string {
  if (status === "Issued") return "ইস্যুড";
  if (status === "Used") return "ব্যবহৃত";
  if (status === "Cancelled") return "বাতিল";
  return "মেয়াদোত্তীর্ণ";
}

export default function CardsTokensPage() {
  const [tab, setTab] = useState<"tokens" | "cards">("tokens");
  const [tokens, setTokens] = useState<DistributionToken[]>([]);
  const [cards, setCards] = useState<ConsumerCardRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"সব" | TokenStatus>("সব");
  const [cardStatus, setCardStatus] = useState<
    "সব" | "Active" | "Inactive" | "Revoked"
  >("সব");
  const [scanInput, setScanInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalTokens: 0,
    issued: 0,
    used: 0,
    cancelled: 0,
    mismatches: 0,
  });
  const [openScan, setOpenScan] = useState(false);
  const [openCard, setOpenCard] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ConsumerCardDetail | null>(
    null,
  );
  const [openTokenQr, setOpenTokenQr] = useState(false);
  const [selectedToken, setSelectedToken] = useState<DistributionToken | null>(
    null,
  );
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [selectedConsumerCode, setSelectedConsumerCode] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [tokenData, statsData] = await Promise.all([
        getDistributionTokens({ limit: 300, withImage: true }),
        getDistributionStats(),
      ]);
      const cardData = await getConsumerCards({ limit: 300 });
      setTokens(tokenData.tokens);
      setStats(statsData);
      setCards(cardData.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    return tokens.filter((token) => {
      const consumer =
        typeof token.consumerId === "string" ? null : token.consumerId;
      const matchSearch =
        !search.trim() ||
        token.tokenCode.toLowerCase().includes(search.toLowerCase()) ||
        consumer?.consumerCode?.toLowerCase().includes(search.toLowerCase()) ||
        consumer?.name?.includes(search);

      const matchStatus = status === "সব" || token.status === status;
      return matchSearch && matchStatus;
    });
  }, [tokens, search, status]);

  const onIssue = async () => {
    const sourceInput = selectedConsumerCode.trim() || scanInput.trim();
    if (!sourceInput) {
      setError("Consumer Code বা QR payload দিন");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await issueToken(sourceInput);
      const plannedDate =
        result?.sessionDateKey || result?.token?.sessionDateKey;
      setMessage(
        plannedDate
          ? `টোকেন ইস্যু হয়েছে (সেশন তারিখ: ${plannedDate})`
          : "টোকেন ইস্যু হয়েছে",
      );
      setOpenScan(false);
      setScanInput("");
      setSelectedConsumerCode("");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "টোকেন ইস্যু ব্যর্থ হয়েছে",
      );
    } finally {
      setLoading(false);
    }
  };

  const onCancel = async (tokenId: string) => {
    const confirmed = window.confirm("এই টোকেনটি বাতিল করবেন?");
    if (!confirmed) return;

    try {
      setLoading(true);
      await cancelDistributionToken(tokenId);
      setMessage("টোকেন বাতিল করা হয়েছে");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "টোকেন বাতিল ব্যর্থ হয়েছে",
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchSearch =
        !search.trim() ||
        card.consumerCode.toLowerCase().includes(search.toLowerCase()) ||
        card.name?.toLowerCase().includes(search.toLowerCase()) ||
        card.ward?.toLowerCase().includes(search.toLowerCase());

      const matchCardStatus =
        cardStatus === "সব" || card.cardStatus === cardStatus;

      return matchSearch && matchCardStatus;
    });
  }, [cards, search, cardStatus]);

  const issueCandidates = useMemo(() => {
    if (!eligibleOnly) return filteredCards;
    return filteredCards.filter(
      (card) =>
        card.cardStatus === "Active" &&
        card.qrStatus === "Valid" &&
        !!card.consumerCode,
    );
  }, [filteredCards, eligibleOnly]);

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
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    const validToText = card.validTo
      ? new Date(card.validTo).toLocaleDateString("bn-BD")
      : "—";
    const qrImage = card.qrImageDataUrl || "";

    win.document.write(`
      <html>
        <head>
          <title>OMS Card - ${card.consumerCode}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; }
            .card { width: 720px; border: 2px solid #0f4c75; border-radius: 12px; padding: 20px; }
            .header { display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 28px; font-weight: 700; color: #0f4c75; }
            .sub { color: #475569; font-size: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 220px; gap: 18px; margin-top: 14px; }
            .kv { margin-bottom: 8px; font-size: 14px; }
            .qr { text-align: center; border: 1px solid #dbe3ef; border-radius: 10px; padding: 10px; }
            .footer { margin-top: 12px; font-size: 12px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div>
                <div class="title">আমার রেশন — OMS কার্ড</div>
                <div class="sub">Beneficiary Identity Card</div>
              </div>
              <div><b>${card.consumerCode}</b></div>
            </div>
            <div class="grid">
              <div>
                <div class="kv"><b>নাম:</b> ${card.name}</div>
                <div class="kv"><b>ক্যাটাগরি:</b> ${card.category}</div>
                <div class="kv"><b>ওয়ার্ড:</b> ${card.ward || "—"}</div>
                <div class="kv"><b>ইউনিয়ন:</b> ${card.unionName || "—"}</div>
                <div class="kv"><b>উপজেলা:</b> ${card.upazila || "—"}</div>
                <div class="kv"><b>কার্ড স্ট্যাটাস:</b> ${card.cardStatus}</div>
                <div class="kv"><b>QR স্ট্যাটাস:</b> ${card.qrStatus}</div>
                <div class="kv"><b>Valid To:</b> ${validToText}</div>
              </div>
              <div class="qr">
                ${qrImage ? `<img src="${qrImage}" width="200" height="200" alt="QR" />` : "<div>QR unavailable</div>"}
                <div style="font-size:11px; margin-top:6px; word-break:break-all;">${card.qrPayload || ""}</div>
              </div>
            </div>
            <div class="footer">Generated: ${new Date().toLocaleString("bn-BD")}</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-3">
      <PortalSection
        title="কার্ড / টোকেন ব্যবস্থাপনা"
        right={
          <div className="flex gap-2">
            <Button onClick={() => setOpenScan(true)}>🎫 টোকেন ইস্যু</Button>
            <Button variant="secondary" onClick={() => void loadData()}>
              🔄 রিফ্রেশ
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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <div className="border rounded p-2 text-[12px]">
            মোট টোকেন: <b>{stats.totalTokens}</b>
          </div>
          <div className="border rounded p-2 bg-[#eff6ff] text-[12px]">
            ইস্যুড: <b>{stats.issued}</b>
          </div>
          <div className="border rounded p-2 bg-[#ecfdf5] text-[12px]">
            ব্যবহৃত: <b>{stats.used}</b>
          </div>
          <div className="border rounded p-2 bg-[#fef2f2] text-[12px]">
            বাতিল: <b>{stats.cancelled}</b>
          </div>
          <div className="border rounded p-2 bg-[#fffbeb] text-[12px]">
            মিসম্যাচ: <b>{stats.mismatches}</b>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <Button
            onClick={() => setTab("tokens")}
            variant={tab === "tokens" ? "primary" : "secondary"}
          >
            🎫 টোকেন
          </Button>
          <Button
            onClick={() => setTab("cards")}
            variant={tab === "cards" ? "primary" : "secondary"}
          >
            🪪 OMS কার্ড
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder={
              tab === "tokens"
                ? "সার্চ: Token / Consumer / নাম"
                : "সার্চ: Consumer / নাম / ওয়ার্ড"
            }
          />
          {tab === "tokens" ? (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "সব" | TokenStatus)}
              className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
            >
              <option value="সব">সব স্ট্যাটাস</option>
              <option value="Issued">ইস্যুড</option>
              <option value="Used">ব্যবহৃত</option>
              <option value="Cancelled">বাতিল</option>
              <option value="Expired">মেয়াদোত্তীর্ণ</option>
            </select>
          ) : (
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
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Revoked">Revoked</option>
            </select>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setStatus("সব");
              setCardStatus("সব");
            }}
          >
            রিসেট
          </Button>
        </div>

        {tab === "tokens" ? (
          <div className="border border-[#cfd6e0] rounded overflow-hidden">
            <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
              টোকেন তালিকা
            </div>
            <div className="overflow-x-auto bg-white">
              <table className="w-full min-w-225 text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="border border-[#cfd6e0] p-2">টোকেন</th>
                    <th className="border border-[#cfd6e0] p-2">উপকারভোগী</th>
                    <th className="border border-[#cfd6e0] p-2">নাম</th>
                    <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                    <th className="border border-[#cfd6e0] p-2">
                      পরিমাণ (কেজি)
                    </th>
                    <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                    <th className="border border-[#cfd6e0] p-2">QR</th>
                    <th className="border border-[#cfd6e0] p-2">ইস্যু সময়</th>
                    <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((token) => {
                    const consumer =
                      typeof token.consumerId === "string"
                        ? null
                        : token.consumerId;
                    return (
                      <tr
                        key={token._id}
                        className="odd:bg-white even:bg-[#f8fafc]"
                      >
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {token.tokenCode}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {consumer?.consumerCode || "—"}
                        </td>
                        <td className="border border-[#cfd6e0] p-2">
                          {consumer?.name || "—"}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {consumer?.ward || "—"}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {token.rationQtyKg.toFixed(2)}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          <Badge tone={statusTone[token.status]}>
                            {tokenStatusLabel(token.status)}
                          </Badge>
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {token.qrImageDataUrl ? (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setSelectedToken(token);
                                setOpenTokenQr(true);
                              }}
                            >
                              👁️ QR
                            </Button>
                          ) : (
                            <span className="text-[#6b7280]">—</span>
                          )}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {new Date(token.issuedAt).toLocaleString()}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {token.status === "Issued" ? (
                            <Button
                              variant="danger"
                              onClick={() => void onCancel(token._id)}
                            >
                              বাতিল
                            </Button>
                          ) : (
                            <span className="text-[#6b7280]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="p-4 text-center text-[#6b7280]"
                      >
                        {loading ? "লোড হচ্ছে..." : "কোনো ডেটা নেই"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="border border-[#cfd6e0] rounded overflow-hidden">
            <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
              OMS কার্ড তালিকা
            </div>
            <div className="overflow-x-auto bg-white">
              <table className="w-full min-w-250 text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="border border-[#cfd6e0] p-2">কোড</th>
                    <th className="border border-[#cfd6e0] p-2">নাম</th>
                    <th className="border border-[#cfd6e0] p-2">ক্যাটাগরি</th>
                    <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                    <th className="border border-[#cfd6e0] p-2">কার্ড</th>
                    <th className="border border-[#cfd6e0] p-2">QR</th>
                    <th className="border border-[#cfd6e0] p-2">Valid To</th>
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
                      <td className="border border-[#cfd6e0] p-2">
                        {card.name}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {card.category}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {card.ward || "—"}
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
                          {card.cardStatus}
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
                          {card.qrStatus}
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
                      <td
                        colSpan={8}
                        className="p-4 text-center text-[#6b7280]"
                      >
                        {loading ? "লোড হচ্ছে..." : "কোনো কার্ড ডেটা নেই"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PortalSection>

      <Modal
        open={openScan}
        title="স্ক্যান / টোকেন ইস্যু"
        onClose={() => setOpenScan(false)}
      >
        <div className="space-y-3">
          <div className="text-[12px] text-[#374151]">
            উপকারভোগী কোড / OMS QR / QR payload দিন
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[#374151]">
            <input
              type="checkbox"
              checked={eligibleOnly}
              onChange={(e) => setEligibleOnly(e.target.checked)}
            />
            সমস্যা-মুক্ত উপকারভোগী (Active card + Valid QR) দেখান
          </label>
          <select
            value={selectedConsumerCode}
            onChange={(e) => setSelectedConsumerCode(e.target.value)}
            className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">তালিকা থেকে উপকারভোগী বাছুন (ঐচ্ছিক)</option>
            {issueCandidates.map((card) => (
              <option key={card.consumerId} value={card.consumerCode}>
                {card.consumerCode} — {card.name} (ওয়ার্ড {card.ward || "—"})
              </option>
            ))}
          </select>
          <input
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="যেমন: C0001 অথবা QR payload"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenScan(false)}>
              বাতিল
            </Button>
            <Button onClick={() => void onIssue()} disabled={loading}>
              ইস্যু করুন
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openTokenQr}
        title="টোকেন QR প্রিভিউ"
        onClose={() => setOpenTokenQr(false)}
      >
        <div className="space-y-3">
          <div className="text-[12px]">
            টোকেন: <b>{selectedToken?.tokenCode || "—"}</b>
          </div>
          <div className="text-[12px]">
            সেশন তারিখ: <b>{selectedToken?.sessionDateKey || "—"}</b>
          </div>
          <div className="border rounded p-2 flex justify-center bg-[#f8fafc]">
            {selectedToken?.qrImageDataUrl ? (
              <img
                src={selectedToken.qrImageDataUrl}
                alt="Token QR"
                className="w-44 h-44"
              />
            ) : (
              <div className="text-[12px] text-[#6b7280]">QR unavailable</div>
            )}
          </div>
          <div className="text-[11px] text-[#6b7280] break-all">
            {selectedToken?.qrPayload || ""}
          </div>
          <div className="text-[11px] text-[#6b7280] break-all">
            OMS QR: {selectedToken?.omsQrPayload || "—"}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpenTokenQr(false)}>
              বন্ধ
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openCard}
        title="OMS কার্ড প্রিভিউ"
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
              ক্যাটাগরি: <b>{selectedCard?.category}</b>
            </div>
            <div>
              ওয়ার্ড: <b>{selectedCard?.ward || "—"}</b>
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
              🖨️ কার্ড প্রিন্ট/PDF
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
