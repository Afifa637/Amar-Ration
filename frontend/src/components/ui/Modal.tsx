import type { ReactNode } from "react";
import Button from "./Button";

export default function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-[760px] bg-white rounded border border-[#d7dde6] shadow-lg">
        <div className="px-4 py-3 border-b border-[#d7dde6] bg-[#f3f5f8] flex items-center justify-between">
          <div className="font-semibold text-[#111827]">{title}</div>
          <Button variant="secondary" onClick={onClose}>
            বন্ধ করুন
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
