"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { rememberService, type KnownService } from "@/lib/services/known";

// A link to a Service page that hands what it already knows (name, status) to the loading screen.
export default function ServiceLink({
  service,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { service: KnownService & { id: string } }) {
  const { id, ...summary } = service;
  return (
    <Link
      {...props}
      href={`/services/${id}`}
      onClick={(e) => {
        rememberService(id, summary);
        onClick?.(e);
      }}
    />
  );
}
