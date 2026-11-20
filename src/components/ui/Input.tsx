import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const base =
  "w-full rounded-md border border-border bg-bg px-2.5 text-sm text-fg placeholder:text-muted/60 " +
  "focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "py-2", className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-[13px] text-muted", className)} {...props} />;
}

export default Input;
