import type { ReactNode } from "react";

export default function PortalSection({
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
      <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6] flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-[#1f2d3d]">{title}</h2>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}
