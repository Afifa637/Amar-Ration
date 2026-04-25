import type { ConsumerCardDetail } from "../../services/api";
import { resolveBackendUrl } from "../../services/api";

const APP_LOGO = "/assets/image/app_logo.png";

function cardStatusBn(status?: ConsumerCardDetail["cardStatus"]) {
  if (status === "Active") return "সক্রিয়";
  if (status === "Revoked") return "বাতিল";
  if (status === "Inactive") return "নিষ্ক্রিয়";
  return "—";
}

function qrStatusBn(status?: ConsumerCardDetail["qrStatus"]) {
  if (status === "Valid") return "বৈধ";
  if (status === "Revoked") return "বাতিল";
  if (status === "Expired") return "মেয়াদোত্তীর্ণ";
  if (status === "Invalid") return "অবৈধ";
  return "—";
}

export default function ArRationCardView({
  card,
}: {
  card: ConsumerCardDetail | null;
}) {
  if (!card) return null;

  const infoRows = [
    { label: "নাম", value: card.name || "—" },
    { label: "কোড", value: card.consumerCode || "—" },
    { label: "ক্যাটাগরি", value: card.category || "—" },
    { label: "বিভাগ", value: card.division || "—" },
    { label: "ওয়ার্ড", value: card.ward || "—" },
    { label: "ইউনিয়ন", value: card.unionName || "—" },
    { label: "উপজেলা", value: card.upazila || "—" },
    { label: "কার্ড স্ট্যাটাস", value: cardStatusBn(card.cardStatus) },
    { label: "কিউআর স্ট্যাটাস", value: qrStatusBn(card.qrStatus) },
    {
      label: "মেয়াদ",
      value: card.validTo
        ? new Date(card.validTo).toLocaleDateString("bn-BD")
        : "—",
    },
  ];

  return (
    <div className="rounded-2xl border border-[#9dd6ea] overflow-hidden shadow-md bg-white">
      <div className="bg-linear-to-r from-[#0b4f88] via-[#0284c7] to-[#14b8a6] text-white px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img
              src={APP_LOGO}
              alt="আমার রেশন"
              className="w-8 h-8 bg-white rounded p-1"
            />
            <div>
              <div className="font-bold">Amar-Ration Card</div>
              <div className="text-[11px] opacity-90">
                সরকারি উপকারভোগী কার্ড
              </div>
            </div>
          </div>
          <div className="text-[12px] font-semibold opacity-95">
            ডিজিটাল পরিচয়
          </div>
        </div>
      </div>

      <div className="bg-linear-to-r from-[#f0f9ff] via-[#ffffff] to-[#eefdf6] p-3 md:p-4 text-[12px]">
        <div className="grid grid-cols-1 md:grid-cols-[128px_minmax(0,1fr)_224px] gap-3 items-stretch">
          <div className="rounded-xl border border-[#a5d8f3] bg-white p-2 flex items-center justify-center min-h-32">
            {card.photoUrl ? (
              <img
                src={resolveBackendUrl(card.photoUrl) ?? ""}
                alt="উপকারভোগীর ছবি"
                className="w-24 h-24 md:w-26 md:h-26 rounded-lg object-cover border border-[#bfdbfe]"
              />
            ) : (
              <div className="text-[12px] text-[#6b7280] text-center">
                ছবি সংযুক্ত নেই
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 self-center">
            {infoRows.map((row, idx) => (
              <div
                key={row.label}
                className={`rounded-lg border p-2 ${idx % 3 === 0 ? "border-[#bae6fd] bg-[#f0f9ff]" : idx % 3 === 1 ? "border-[#bbf7d0] bg-[#f0fdf4]" : "border-[#fcd34d] bg-[#fffbeb]"}`}
              >
                <div className="text-[10px] text-[#475569]">{row.label}</div>
                <div className="text-[12px] font-bold text-[#0f172a] wrap-break-word">
                  {row.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#86efac] bg-[#ecfdf5] p-2 flex flex-col items-center justify-center">
            {card.qrImageDataUrl ? (
              <img
                src={card.qrImageDataUrl}
                alt="রেশন কার্ড কিউআর"
                className="w-48 h-48 md:w-52 md:h-52"
              />
            ) : (
              <div className="text-[12px] text-[#6b7280] text-center">
                কিউআর অনুপলব্ধ
              </div>
            )}
            <div className="text-[10px] text-[#0f172a] mt-2 break-all text-center font-medium">
              {card.qrPayload || ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
