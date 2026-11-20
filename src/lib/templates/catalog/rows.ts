import type { DrawRow } from "@/lib/draw/ops";
import { wireToRows, type RawWireOp } from "@/lib/draw/wire";

// Wire ops -> rows with stable ids (`<template>-<index>`), so server and client render agree.
// Throws on invalid wire, so a broken template fails the build instead of shipping.
export function rows(id: string, wire: RawWireOp[]): DrawRow[] {
  const res = wireToRows(wire);
  if (!res.ok) throw new Error(`Template "${id}": ${res.error}`);
  return res.rows.map((r, i) => ({ ...r, id: `${id}-${i}` }));
}
