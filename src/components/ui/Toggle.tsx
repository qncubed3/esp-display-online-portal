"use client";

import { cn } from "./cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function Toggle({ checked, onChange, disabled, label, className }: ToggleProps) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-[13px] text-muted",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 cursor-pointer rounded-full border transition-colors",
          checked ? "border-accent bg-accent" : "border-border-strong bg-panel-hover",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0 h-3.5 w-3.5 rounded-full bg-white transition-transform",
            checked ? "translate-x-[17px]" : "translate-x-0.5",
          )}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}

export default Toggle;
