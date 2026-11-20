"use client";

import { useCallback, useRef, useState } from "react";

const GROUP_MS = 500;
const LIMIT = 100;

/**
 * A value with undo/redo. Changes arriving within GROUP_MS of the previous one are merged into
 * one undo step (a drag in the preview or typing in a field), unless set with `{ group: false }`.
 */
export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState(initial);
  const presentRef = useRef(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastAt = useRef(0);

  const replace = (next: T) => {
    presentRef.current = next;
    setPresent(next); // re-renders, which also refreshes canUndo / canRedo below
  };

  const set = useCallback((next: T, opts?: { group?: boolean }) => {
    if (Object.is(next, presentRef.current)) return;
    const now = Date.now();
    const grouping = opts?.group !== false;
    if (!grouping || now - lastAt.current > GROUP_MS) {
      past.current.push(presentRef.current);
      if (past.current.length > LIMIT) past.current.shift();
    }
    lastAt.current = grouping ? now : 0;
    future.current = [];
    replace(next);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(presentRef.current);
    lastAt.current = 0;
    replace(prev);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(presentRef.current);
    lastAt.current = 0;
    replace(next);
  }, []);

  return {
    value: present,
    set,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
