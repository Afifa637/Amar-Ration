export default function Badge({
  tone = "gray",
  children,
}: {
  tone?: "green" | "red" | "yellow" | "blue" | "gray" | "purple";
  children: string;
}) {
  const map: Record<string, string> = {
    green: "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]",
    red: "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]",
    yellow: "bg-[#fffbeb] text-[#92400e] border-[#fde68a]",
    blue: "bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]",
    purple: "bg-[#f5f3ff] text-[#5b21b6] border-[#ddd6fe]",
    gray: "bg-[#f3f4f6] text-[#374151] border-[#e5e7eb]",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[12px] ${map[tone]}`}>
      {children}
    </span>
  );
}
