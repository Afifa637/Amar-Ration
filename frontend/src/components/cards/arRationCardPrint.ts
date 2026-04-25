import type { ConsumerCardDetail } from "../../services/api";
import { resolveBackendUrl } from "../../services/api";

const APP_LOGO = "/assets/image/app_logo.png";

export function buildArRationCardPrintHtml(card: ConsumerCardDetail) {
  const validToText = card.validTo
    ? new Date(card.validTo).toLocaleDateString("bn-BD")
    : "—";
  const updatedAtText = card.updatedAt
    ? new Date(card.updatedAt).toLocaleString("bn-BD")
    : "—";
  const cardStatusText =
    card.cardStatus === "Active"
      ? "সক্রিয়"
      : card.cardStatus === "Revoked"
        ? "বাতিল"
        : card.cardStatus === "Inactive"
          ? "নিষ্ক্রিয়"
          : "—";
  const qrStatusText =
    card.qrStatus === "Valid"
      ? "বৈধ"
      : card.qrStatus === "Revoked"
        ? "বাতিল"
        : card.qrStatus === "Expired"
          ? "মেয়াদোত্তীর্ণ"
          : card.qrStatus === "Invalid"
            ? "অবৈধ"
            : "—";
  const infoRows = [
    { label: "নাম", value: card.name || "—" },
    { label: "কোড", value: card.consumerCode || "—" },
    { label: "ক্যাটাগরি", value: card.category || "—" },
    { label: "বিভাগ", value: card.division || "—" },
    { label: "ওয়ার্ড", value: card.ward || "—" },
    { label: "ইউনিয়ন", value: card.unionName || "—" },
    { label: "উপজেলা", value: card.upazila || "—" },
    { label: "কার্ড স্ট্যাটাস", value: cardStatusText },
    { label: "কিউআর স্ট্যাটাস", value: qrStatusText },
    { label: "মেয়াদ", value: validToText },
    { label: "সর্বশেষ আপডেট", value: updatedAtText },
  ];

  const infoRowsHtml = infoRows
    .map((row, i) => {
      const tone = i % 3;
      const cls =
        tone === 0
          ? "kv kv-blue"
          : tone === 1
            ? "kv kv-green"
            : "kv kv-amber";
      return `<div class="${cls}"><div class="k">${row.label}</div><div class="v">${row.value}</div></div>`;
    })
    .join("");

  return `
    <html>
      <head>
        <title>Amar-Ration Card - ${card.consumerCode}</title>
        <style>
          body { margin: 0; padding: 18px; font-family: 'Noto Sans Bengali', 'Segoe UI', Arial, sans-serif; background: #f1f5f9; }
          .card { width: 860px; margin: 0 auto; border-radius: 18px; overflow: hidden; box-shadow: 0 14px 35px rgba(2,6,23,.18); border: 1px solid #cbd5e1; background: white; }
          .head { background: linear-gradient(135deg, #0b4f88 0%, #0284c7 58%, #14b8a6 100%); color: white; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
          .brand { display: flex; align-items: center; gap: 10px; }
          .logo { width: 46px; height: 46px; border-radius: 8px; background: #ffffff; padding: 4px; box-sizing: border-box; }
          .title { font-size: 24px; font-weight: 800; letter-spacing: .2px; }
          .sub { font-size: 12px; opacity: .95; }
          .body { display: grid; grid-template-columns: 132px 1fr 250px; gap: 12px; padding: 14px 16px 16px; background: linear-gradient(90deg,#f0f9ff 0%,#ffffff 48%,#ecfdf5 100%); align-items: stretch; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: center; }
          .kv { border-radius: 10px; padding: 8px 10px; font-size: 13px; border: 1px solid transparent; }
          .kv-blue { background: #f0f9ff; border-color: #bae6fd; }
          .kv-green { background: #f0fdf4; border-color: #bbf7d0; }
          .kv-amber { background: #fffbeb; border-color: #fde68a; }
          .k { color: #475569; font-size: 11px; letter-spacing: .2px; }
          .v { color: #0f172a; font-weight: 700; margin-top: 2px; }
          .photo { border: 1px solid #a5d8f3; border-radius: 12px; padding: 10px; background: #ffffff; text-align: center; min-height: 220px; display: flex; align-items: center; justify-content: center; }
          .photo img { width: 108px; height: 108px; border-radius: 10px; object-fit: cover; border: 1px solid #bfdbfe; }
          .qr { border: 1px solid #86efac; border-radius: 12px; padding: 10px; background: #ecfdf5; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .payload { margin-top: 8px; font-size: 11px; color: #1e293b; word-break: break-all; }
          .foot { padding: 10px 16px 14px; font-size: 11px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="head">
            <div class="brand">
              <img src="${APP_LOGO}" class="logo" alt="আমার রেশন" />
              <div>
                <div class="title">Amar-Ration Card</div>
                <div class="sub">সরকারি উপকারভোগী পরিচয়পত্র</div>
              </div>
            </div>
            <div style="font-weight:800;font-size:18px;">${card.consumerCode}</div>
          </div>
          <div class="body">
            <div class="photo">
              ${card.photoUrl ? `<img src="${resolveBackendUrl(card.photoUrl) ?? ""}" alt="উপকারভোগীর ছবি" />` : "<div>ছবি সংযুক্ত নেই</div>"}
            </div>
            <div class="grid">
              ${infoRowsHtml}
            </div>
            <div class="qr">
              ${card.qrImageDataUrl ? `<img src="${card.qrImageDataUrl}" width="238" height="238" alt="কার্ড কিউআর" />` : "<div>কিউআর অনুপলব্ধ</div>"}
              <div class="payload">${card.qrPayload || ""}</div>
            </div>
          </div>
          <div class="foot">প্রস্তুতকরণ সময়: ${new Date().toLocaleString("bn-BD")} • আমার রেশন কর্তৃপক্ষ</div>
        </div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `;
}
