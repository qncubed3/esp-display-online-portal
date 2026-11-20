// Runs a Service's Data section (user JS) in a QuickJS WebAssembly sandbox.
//
// The code is evaluated as an ES module, so it can use top-level `await` and
// `export const name = ...`. Its string/number/boolean exports become the
// variables that fill {name} placeholders in the Draw section.
//
// Host functions available to the code:
//   get(url, { cache?: seconds })  -> parsed JSON (or text), GET only, cached per URL
//   now(format?)                   -> Australia/Melbourne time, tokens HH mm ss DD MM YYYY ddd
//   console.log(...)               -> server log
//
// Approach: the synchronous QuickJS build (no asyncify). `get` returns a VM promise
// whose resolution is driven from the host; we pump `runtime.executePendingJobs()`
// until the module's evaluation promise settles. CPU time is limited by an
// interrupt handler that only counts time spent inside the VM (not network waits).

import { getQuickJS, type QuickJSContext, type QuickJSDeferredPromise, type QuickJSHandle } from "quickjs-emscripten";

export type DataVars = Record<string, string | number | boolean>;
export interface DataResult {
  vars: DataVars;
  error?: string;
}

const CPU_BUDGET_MS = 2000; // time spent executing JS inside the VM
const WALL_LIMIT_MS = 15000; // whole run, including network waits
const MEMORY_LIMIT = 32 * 1024 * 1024;
const STACK_LIMIT = 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_CACHE_S = 30;
const MAX_CACHE_ENTRIES = 200;
const MAX_GETS_PER_RUN = 20;
const TZ = "Australia/Melbourne";

// ---------- get() with a module-level cache (shared across requests on a warm instance)

interface CacheEntry {
  expires: number;
  text: string;
}
const cache = new Map<string, CacheEntry>();
const inflightFetches = new Map<string, Promise<string>>();

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "esp-display-portal", Accept: "application/json, text/plain, */*" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`get ${url}: HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length"));
  if (len > MAX_BODY_BYTES) throw new Error(`get ${url}: response larger than 1 MB`);
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error(`get ${url}: response larger than 1 MB`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function cachedGet(rawUrl: string, cacheSeconds: number): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`get: invalid URL "${rawUrl}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("get: only http(s) URLs are allowed");
  const key = url.toString();

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.text;

  let pending = inflightFetches.get(key);
  if (!pending) {
    pending = fetchText(key).finally(() => inflightFetches.delete(key));
    inflightFetches.set(key, pending);
  }
  const text = await pending;

  if (cacheSeconds > 0) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const now = Date.now();
      for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
    }
    cache.set(key, { expires: Date.now() + cacheSeconds * 1000, text });
  }
  return text;
}

// ---------- now()

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateParts = new Intl.DateTimeFormat("en-AU", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

export function formatNow(format = "HH:mm", date = new Date()): string {
  const p: Record<string, string> = {};
  for (const part of dateParts.formatToParts(date)) p[part.type] = part.value;
  const weekday = WEEKDAYS.find((d) => p.weekday?.startsWith(d)) ?? p.weekday ?? "";
  const tokens: Record<string, string> = {
    YYYY: p.year,
    MM: p.month,
    DD: p.day,
    HH: p.hour === "24" ? "00" : p.hour,
    mm: p.minute,
    ss: p.second,
    ddd: weekday,
  };
  return format.replace(/YYYY|ddd|DD|MM|HH|mm|ss/g, (t) => tokens[t] ?? t);
}

// ---------- sandbox

// Runs as a global script before the module, wrapping the raw host functions.
const PRELUDE = `
(() => {
  const fetchRaw = globalThis.__fetch;
  const logRaw = globalThis.__log;
  delete globalThis.__fetch;
  delete globalThis.__log;
  globalThis.get = async (url, opts) => {
    const text = await fetchRaw(String(url), opts && opts.cache != null ? Number(opts.cache) : ${DEFAULT_CACHE_S});
    try { return JSON.parse(text); } catch { return text; }
  };
  const fmt = (a) => { if (typeof a === "string") return a; try { return JSON.stringify(a); } catch { return String(a); } };
  const log = (...args) => logRaw(args.map(fmt).join(" "));
  globalThis.console = { log, info: log, warn: log, error: log, debug: log };
})();
`;

function errorMessage(vm: QuickJSContext, handle: QuickJSHandle): string {
  const e = vm.dump(handle);
  if (e && typeof e === "object") {
    const name = typeof e.name === "string" ? e.name : "Error";
    const msg = typeof e.message === "string" ? e.message : JSON.stringify(e);
    if (name === "InternalError" && msg === "interrupted") return "Data code took too long (over 2s of CPU)";
    return name === "Error" ? msg : `${name}: ${msg}`;
  }
  return String(e);
}

export async function runDataCode(code: string): Promise<DataResult> {
  if (!code || !code.trim()) return { vars: {} };

  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT);
  runtime.setMaxStackSize(STACK_LIMIT);

  // CPU budget: only time spent inside evalCode/executePendingJobs counts.
  let budgetLeft = CPU_BUDGET_MS;
  let sliceDeadline = 0;
  runtime.setInterruptHandler(() => Date.now() > sliceDeadline);
  const inVm = <T>(fn: () => T): T => {
    const start = Date.now();
    sliceDeadline = start + budgetLeft;
    try {
      return fn();
    } finally {
      budgetLeft -= Date.now() - start;
    }
  };

  const vm = runtime.newContext();
  const deferreds: QuickJSDeferredPromise[] = [];
  const pending = new Set<Promise<void>>();
  let getCount = 0;

  try {
    // Host functions
    const fetchFn = vm.newFunction("__fetch", (urlH, cacheH) => {
      const deferred = vm.newPromise();
      deferreds.push(deferred);
      const url = vm.getString(urlH);
      const cacheS = cacheH ? Number(vm.getNumber(cacheH)) : DEFAULT_CACHE_S;
      const job = (++getCount > MAX_GETS_PER_RUN
        ? Promise.reject(new Error(`get: more than ${MAX_GETS_PER_RUN} calls`))
        : cachedGet(url, Number.isFinite(cacheS) ? Math.max(0, cacheS) : DEFAULT_CACHE_S)
      ).then(
        (text) => {
          if (!vm.alive || !deferred.alive) return;
          const s = vm.newString(text);
          deferred.resolve(s);
          s.dispose();
        },
        (err: unknown) => {
          if (!vm.alive || !deferred.alive) return;
          const e = vm.newError(err instanceof Error ? (err.name === "TimeoutError" ? `get ${url}: timed out` : err.message) : String(err));
          deferred.reject(e);
          e.dispose();
        },
      );
      const tracked = job.finally(() => pending.delete(tracked));
      pending.add(tracked);
      return deferred.handle;
    });
    vm.setProp(vm.global, "__fetch", fetchFn);
    fetchFn.dispose();

    const logFn = vm.newFunction("__log", (msgH) => {
      console.log("[data]", vm.getString(msgH).slice(0, 500));
    });
    vm.setProp(vm.global, "__log", logFn);
    logFn.dispose();

    const nowFn = vm.newFunction("now", (fmtH) => {
      const fmt = fmtH && vm.typeof(fmtH) === "string" ? vm.getString(fmtH) : "HH:mm";
      return vm.newString(formatNow(fmt));
    });
    vm.setProp(vm.global, "now", nowFn);
    nowFn.dispose();

    vm.unwrapResult(inVm(() => vm.evalCode(PRELUDE, "prelude.js", { type: "global" }))).dispose();

    // Evaluate the user's module; the result is (a promise for) its exports.
    const evalResult = inVm(() => vm.evalCode(code, "data.js", { type: "module" }));
    if (evalResult.error) {
      const msg = errorMessage(vm, evalResult.error);
      evalResult.error.dispose();
      return { vars: {}, error: msg };
    }
    const moduleHandle = evalResult.value;

    try {
      const wallDeadline = Date.now() + WALL_LIMIT_MS;
      for (;;) {
        const jobs = inVm(() => runtime.executePendingJobs());
        if (jobs.error) {
          const msg = errorMessage(vm, jobs.error);
          jobs.error.dispose();
          return { vars: {}, error: msg };
        }

        const state = vm.getPromiseState(moduleHandle);
        if (state.type === "rejected") {
          const msg = errorMessage(vm, state.error);
          state.error.dispose();
          return { vars: {}, error: msg };
        }
        if (state.type === "fulfilled") {
          const exportsObj = vm.dump(state.value);
          if (!state.notAPromise) state.value.dispose();
          return { vars: pickScalars(exportsObj) };
        }

        // Still pending: wait for a host get() to settle, then pump jobs again.
        if (pending.size === 0) return { vars: {}, error: "Data code never finished (awaiting something that never resolves)" };
        const left = wallDeadline - Date.now();
        if (left <= 0) return { vars: {}, error: "Data code took too long" };
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          ...pending,
          new Promise<void>((r) => {
            timer = setTimeout(r, left);
          }),
        ]);
        clearTimeout(timer);
      }
    } finally {
      if (moduleHandle.alive) moduleHandle.dispose();
    }
  } catch (err) {
    return { vars: {}, error: err instanceof Error ? err.message : String(err) };
  } finally {
    for (const d of deferreds) if (d.alive) d.dispose();
    try {
      vm.dispose();
      runtime.dispose();
    } catch (err) {
      // A leaked handle makes dispose() assert; log rather than crash the request.
      console.error("[data] dispose failed", err);
    }
  }
}

function pickScalars(obj: unknown): DataVars {
  const vars: DataVars = {};
  if (!obj || typeof obj !== "object") return vars;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) vars[k] = v;
  }
  return vars;
}
