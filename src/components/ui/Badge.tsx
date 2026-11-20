import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "neutral" | "danger";
}

const variants = {
  success: "bg-accent/10 text-accent border-accent/30",
  neutral: "bg-panel-hover text-muted border-border",
  danger: "bg-danger/10 text-[#ff8a8e] border-danger/30",
};

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export default Badge;
