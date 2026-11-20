import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

export type SelectSize = "sm" | "md";

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  children: ReactNode;
  /** sm = h-7 (compact rows, Draw editor); md = h-8 (forms, next to 32px inputs). */
  size?: SelectSize;
};

const base =
  "peer w-full cursor-pointer appearance-none rounded-md border border-[#2e2e2e] bg-[#161616] text-[13px] text-[#ededed] outline-none " +
  "placeholder:text-[#5a5a5a] hover:border-[#3e3e3e] focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[#2e2e2e]";

// The 14px chevron is centred vertically, so the gap to the right edge equals the gap above and
// below it: (28 - 14) / 2 = 7px for sm, (32 - 14) / 2 = 9px for md. The right padding keeps the
// text clear of the icon (gap + icon + gap).
const sizes: Record<SelectSize, { select: string; icon: string }> = {
  sm: { select: "h-7 pl-2 pr-7", icon: "right-[7px]" },
  md: { select: "h-8 pl-2.5 pr-8", icon: "right-[9px]" },
};

// Native select with a custom chevron. `className` styles the wrapper (use it for width/margins).
export function Select({ className, children, size = "sm", ...rest }: SelectProps) {
  const s = sizes[size];
  return (
    <div className={cn("relative", className)}>
      <select {...rest} className={cn(base, s.select)}>
        {children}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted peer-disabled:opacity-60", s.icon)}
      />
    </div>
  );
}

export default Select;
