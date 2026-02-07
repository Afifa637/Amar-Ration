import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-[#1f77b4] hover:bg-[#16679c] text-white",
  secondary: "bg-[#e5e7eb] hover:bg-[#d1d5db] text-[#111827]",
  danger: "bg-[#dc2626] hover:bg-[#b91c1c] text-white",
  ghost:
    "bg-transparent hover:bg-black/5 text-[#111827] border border-[#cfd6e0]",
};

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`h-8 px-3 rounded text-[13px] font-semibold transition ${styles[variant]} ${className}`}
    />
  );
}
