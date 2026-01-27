import { useMemo, useState, useEffect } from "react";

type Option = { label: string; value: string };

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <div className="min-w-[180px]">
      <div className="text-[12px] text-[#374151] mb-1">{label}</div>
      <select
        className="w-full border border-[#cfd6e0] rounded px-2 py-1 text-[13px] bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ✅ Local demo options (later replace by API)
const demoFilters = {
  divisions: [
    { label: "ঢাকা", value: "dhaka" },
    { label: "চট্টগ্রাম", value: "ctg" },
    { label: "রাজশাহী", value: "raj" },
    { label: "খুলনা", value: "khul" },
  ],
  districtsByDivision: {
    dhaka: [
      { label: "ঢাকা", value: "dhaka" },
      { label: "গাজীপুর", value: "gazipur" },
      { label: "নারায়ণগঞ্জ", value: "narayanganj" },
    ],
    ctg: [
      { label: "চট্টগ্রাম", value: "chattogram" },
      { label: "কক্সবাজার", value: "coxsbazar" },
    ],
    raj: [
      { label: "রাজশাহী", value: "rajshahi" },
      { label: "পাবনা", value: "pabna" },
    ],
    khul: [
      { label: "খুলনা", value: "khulna" },
      { label: "যশোর", value: "jashore" },
    ],
  } as Record<string, Option[]>,
  upazilasByDistrict: {
    dhaka: [
      { label: "সাভার", value: "savar" },
      { label: "ধামরাই", value: "dhamrai" },
    ],
    gazipur: [
      { label: "গাজীপুর সদর", value: "gazipur-sadar" },
      { label: "কালীগঞ্জ", value: "kaliganj" },
    ],
    narayanganj: [{ label: "সোনারগাঁও", value: "sonargaon" }],
    chattogram: [{ label: "পটিয়া", value: "patiya" }],
    coxsbazar: [{ label: "কক্সবাজার সদর", value: "cox-sadar" }],
    rajshahi: [{ label: "পবা", value: "paba" }],
    pabna: [{ label: "ঈশ্বরদী", value: "ishwardi" }],
    khulna: [{ label: "দাকোপ", value: "dakop" }],
    jashore: [{ label: "ঝিকরগাছা", value: "jhikargacha" }],
  } as Record<string, Option[]>,
  unionsByUpazila: {
    savar: [
      { label: "তেতুলঝোড়া", value: "tetuljhora" },
      { label: "আশুলিয়া", value: "ashulia" },
    ],
    dhamrai: [{ label: "সূতিপাড়া", value: "sutipara" }],
    "gazipur-sadar": [{ label: "মির্জাপুর", value: "mirzapur" }],
    kaliganj: [{ label: "কাপাসিয়া", value: "kapasia" }],
    sonargaon: [{ label: "বারদী", value: "bardi" }],
    patiya: [{ label: "হাবিলাসদ্বীপ", value: "habilasdwip" }],
    "cox-sadar": [{ label: "ঝিলংজা", value: "jhilongja" }],
    paba: [{ label: "নওহাটা", value: "nowhata" }],
    ishwardi: [{ label: "মুলাডুলি", value: "muladuli" }],
    dakop: [{ label: "কামারখোলা", value: "kamarkhola" }],
    jhikargacha: [{ label: "শংকরপুর", value: "shankorpur" }],
  } as Record<string, Option[]>,
  wards: [
    { label: "ওয়ার্ড-০১", value: "ward-01" },
    { label: "ওয়ার্ড-০২", value: "ward-02" },
    { label: "ওয়ার্ড-০৩", value: "ward-03" },
  ],
  dealers: [
    { label: "ডিলার-০১ (ডেমো)", value: "dealer-01" },
    { label: "ডিলার-০২ (ডেমো)", value: "dealer-02" },
  ],
};

export default function FilterBar() {
  const [division, setDivision] = useState("dhaka");
  const [district, setDistrict] = useState("dhaka");
  const [upazila, setUpazila] = useState("savar");
  const [union, setUnion] = useState("tetuljhora");
  const [ward, setWard] = useState("ward-01");
  const [dealer, setDealer] = useState("dealer-01");

  const divisions = demoFilters.divisions;
  const districts = useMemo(() => demoFilters.districtsByDivision[division] ?? [], [division]);
  const upazilas = useMemo(() => demoFilters.upazilasByDistrict[district] ?? [], [district]);
  const unions = useMemo(() => demoFilters.unionsByUpazila[upazila] ?? [], [upazila]);

  useEffect(() => {
    if (!districts.find((d) => d.value === district)) setDistrict(districts[0]?.value ?? "");
  }, [division, districts, district]);

  useEffect(() => {
    if (!upazilas.some((u) => u.value === upazila)) {
      // Only update if upazilas is not empty and upazila is not valid
      if (upazilas.length > 0) {
        setUpazila(upazilas[0].value);
      } else if (upazila !== "") {
        setUpazila("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district, upazilas]);

  useEffect(() => {
    if (!unions.find((u) => u.value === union)) setUnion(unions[0]?.value ?? "");
  }, [upazila, unions, union]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="বিভাগ" value={division} onChange={setDivision} options={divisions} />
        <Select label="জেলা" value={district} onChange={setDistrict} options={districts} />
        <Select label="উপজেলা" value={upazila} onChange={setUpazila} options={upazilas} />
        <Select label="ইউনিয়ন" value={union} onChange={setUnion} options={unions} />
        <Select label="ওয়ার্ড" value={ward} onChange={setWard} options={demoFilters.wards} />
        <Select label="ডিলার" value={dealer} onChange={setDealer} options={demoFilters.dealers} />

        <button className="h-[30px] px-3 rounded bg-[#1f77b4] text-white text-[13px] hover:bg-[#16679c]">
          অনুসন্ধান
        </button>

        <button
          className="h-[30px] px-3 rounded bg-[#e5e7eb] text-[#111827] text-[13px] hover:bg-[#d1d5db]"
          onClick={() => {
            setDivision("dhaka");
            setDistrict("dhaka");
            setUpazila("savar");
            setUnion("tetuljhora");
            setWard("ward-01");
            setDealer("dealer-01");
          }}
        >
          রিসেট
        </button>
      </div>

      <div className="text-[12px] text-[#6b7280]">
        নির্বাচিত: বিভাগ/জেলা/উপজেলা/ইউনিয়ন/ওয়ার্ড/ডিলার অনুযায়ী সারাংশ দেখাবে।
      </div>
    </div>
  );
}
