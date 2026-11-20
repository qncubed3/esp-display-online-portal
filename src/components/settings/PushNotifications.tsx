"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge, Button } from "@/components/ui";
import SettingsCard, { Message } from "@/components/settings/SettingsCard";
import { pushConfigured, removePushSubscription, savePushSubscription } from "@/lib/notifications/push-actions";

type State = "loading" | "unsupported" | "ios-install" | "not-configured" | "denied" | "off" | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// The VAPID public key is URL-safe base64; PushManager wants the raw bytes.
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

// Settings → Notifications: turn Web Push on or off for this browser.
export default function PushNotifications() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: State;
      if (!supported) next = isIOS() && !isInstalled() ? "ios-install" : "unsupported";
      else if (!PUBLIC_KEY || !(await pushConfigured().catch(() => false))) next = "not-configured";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const sub = await currentSubscription().catch(() => null);
        // Re-save in case the server lost it (e.g. it was pruned, or another account signed in here).
        if (sub && Notification.permission === "granted") await savePushSubscription(sub.toJSON(), navigator.userAgent).catch(() => {});
        next = sub && Notification.permission === "granted" ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    setError(undefined);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "denied") return setState("denied");
        if (permission !== "granted") return;
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
        const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (res.error) {
          await sub.unsubscribe().catch(() => {});
          return setError(res.error);
        }
        setState("on");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not turn on push notifications.");
      }
    });
  }

  function disable() {
    setError(undefined);
    startTransition(async () => {
      try {
        const sub = await currentSubscription();
        if (sub) {
          const res = await removePushSubscription(sub.endpoint);
          if (res.error) return setError(res.error);
          await sub.unsubscribe();
        }
        setState("off");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not turn off push notifications.");
      }
    });
  }

  return (
    <div id="notifications" className="scroll-mt-20">
      <SettingsCard
        title="Notifications"
        description="Get a push notification on this device when someone else changes something that affects you: a device transferred to you, being added to or removed from a Service, devices joining or leaving your Services, and more. They also show in the bell."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium">Push notifications in this browser</p>
              {state === "on" && <Badge variant="success">On</Badge>}
            </div>
            <p className="text-[13px] text-muted">{describe(state)}</p>
            <Message error={error} />
          </div>
          {(state === "on" || state === "off") && (
            <Button
              variant={state === "on" ? "secondary" : "primary"}
              size="sm"
              onClick={state === "on" ? disable : enable}
              disabled={pending}
              className="shrink-0"
            >
              {pending ? "Working..." : state === "on" ? "Turn off" : "Turn on"}
            </Button>
          )}
        </div>
        <p className="mt-4 border-t border-border pt-3 text-[12px] text-muted">
          On iPhone and iPad, push only works once the portal is on your Home Screen: open it in Safari, tap Share, then Add to
          Home Screen, and turn notifications on from the installed app. Each browser or device you want notifications on needs
          its own Turn on.
        </p>
      </SettingsCard>
    </div>
  );
}

function describe(state: State): string {
  switch (state) {
    case "loading":
      return "Checking this browser...";
    case "unsupported":
      return "This browser doesn't support push notifications. You'll still see everything in the bell.";
    case "ios-install":
      return "Add the portal to your Home Screen first (see below), then open it from there to turn notifications on.";
    case "not-configured":
      return "Push notifications aren't set up on the server yet. You'll still see everything in the bell.";
    case "denied":
      return "Notifications are blocked for this site. Allow them in your browser's site settings (the icon left of the address bar, or Settings → Notifications on a phone), then reload this page.";
    case "on":
      return "This browser gets a notification even when the portal is closed.";
    case "off":
      return "Off. Turn on to get notifications on this device even when the portal is closed.";
  }
}
