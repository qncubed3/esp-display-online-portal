import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}

const variants = {
  primary: "bg-accent text-[#111] border-accent hover:bg-accent-hover hover:border-accent-hover",
  secondary: "bg-panel text-fg border-border hover:bg-panel-hover hover:border-border-strong",
  danger: "bg-danger/10 text-[#ff8a8e] border-danger/40 hover:bg-danger/20",
  ghost: "bg-transparent text-muted border-transparent hover:bg-panel-hover hover:text-fg",
};

const sizes = {
  sm: "h-7 px-2.5 text-[13px] gap-1.5",
  md: "h-8 px-3 text-sm gap-2",
};

export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md border font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export default Button;
