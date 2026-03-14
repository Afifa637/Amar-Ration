type Option = { label: string; value: string };

export type DashboardFilterValue = {
  division: string;
  district: string;
  upazila: string;
  unionName: string;
  ward: string;
  dealer: string;
};

export type DashboardFilterOptions = {
  divisions: Option[];
  districts: Option[];
  upazilas: Option[];
  unions: Option[];
  wards: Option[];
  dealers: Option[];
};

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  disabled?: boolean;
}) {
  return (
    <div className="min-w-44">
      <div className="text-[12px] text-[#374151] mb-1">{label}</div>
      <select
        className="w-full border border-[#cfd6e0] rounded px-2 py-1 text-[13px] bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
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

export default function FilterBar({
  value,
  options,
  onChange,
  onApply,
  onReset,
  loading = false,
}: {
  value: DashboardFilterValue;
  options: DashboardFilterOptions;
  onChange: (next: DashboardFilterValue) => void;
  onApply: () => void;
  onReset: () => void;
  loading?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="বিভাগ"
          value={value.division}
          onChange={(division) =>
            onChange({
              ...value,
              division,
              district: "all",
              upazila: "all",
              unionName: "all",
              ward: "all",
            })
          }
          options={options.divisions}
          disabled={loading}
        />
        <Select
          label="জেলা"
          value={value.district}
          onChange={(district) =>
            onChange({
              ...value,
              district,
              upazila: "all",
              unionName: "all",
              ward: "all",
            })
          }
          options={options.districts}
          disabled={loading}
        />
        <Select
          label="উপজেলা"
          value={value.upazila}
          onChange={(upazila) =>
            onChange({ ...value, upazila, unionName: "all", ward: "all" })
          }
          options={options.upazilas}
          disabled={loading}
        />
        <Select
          label="ইউনিয়ন"
          value={value.unionName}
          onChange={(unionName) =>
            onChange({ ...value, unionName, ward: "all" })
          }
          options={options.unions}
          disabled={loading}
        />
        <Select
          label="ওয়ার্ড"
          value={value.ward}
          onChange={(ward) => onChange({ ...value, ward })}
          options={options.wards}
          disabled={loading}
        />
        <Select
          label="ডিলার"
          value={value.dealer}
          onChange={(dealer) => onChange({ ...value, dealer })}
          options={options.dealers}
          disabled={loading}
        />

        <button
          type="button"
          onClick={onApply}
          disabled={loading}
          className="h-8 px-3 rounded bg-[#1f77b4] text-white text-[13px] hover:bg-[#16679c] disabled:opacity-60"
        >
          অনুসন্ধান
        </button>

        <button
          type="button"
          disabled={loading}
          className="h-8 px-3 rounded bg-[#e5e7eb] text-[#111827] text-[13px] hover:bg-[#d1d5db]"
          onClick={onReset}
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
