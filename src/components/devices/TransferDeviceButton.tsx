"use client";

import { useState, type FormEvent } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { transferDevice } from "@/lib/devices/actions";

// Devices page: hand a device to another user by email. Reports the outcome through onDone.
export default function TransferDeviceButton({
  deviceId,
  deviceName,
  disabled,
  className,
  onDone,
}: {
  deviceId: string;
  deviceName: string;
  disabled?: boolean;
  className?: string;
  onDone(message: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setEmail("");
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await transferDevice(deviceId, email);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setEmail("");
      onDone(
        `Transferred "${deviceName}" to ${res.ownerEmail}.` +
          (res.unsubscribed ? " They don't have access to its service, so it was unsubscribed until they pick one." : ""),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="Transfer ownership"
        aria-label={`Transfer ownership of ${deviceName}`}
        className={className}
      >
        <ArrowRightLeft size={13} />
      </button>
      <Dialog
        open={open}
        onClose={close}
        title="Transfer ownership"
        footer={
          <>
            <Button size="sm" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" type="submit" form={`transfer-${deviceId}`} disabled={busy || !email.trim()}>
              {busy && <Loader2 size={14} className="animate-spin" />}
              Transfer
            </Button>
          </>
        }
      >
        <form id={`transfer-${deviceId}`} onSubmit={submit} className="space-y-3 text-[13px]">
          <p className="text-muted">
            Give <span className="text-fg">{deviceName}</span> to another user. It keeps its key, so it keeps working without a
            reflash, but you lose access to it. If they can&apos;t access its current service, it&apos;s unsubscribed until they pick
            one. They&apos;ll get a notification.
          </p>
          <label className="block space-y-1.5">
            <span className="text-muted">New owner&apos;s email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoFocus
              required
            />
          </label>
          {error && <p className="text-[#ff8a8e]">{error}</p>}
        </form>
      </Dialog>
    </>
  );
}
