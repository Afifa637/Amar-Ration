import type { ReactNode } from "react";

export default function SectionCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-[#d7dde6] rounded">
      <div className="flex items-center justify-between px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
        <h2 className="text-[14px] font-semibold text-[#1f2d3d]">{title}</h2>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}
