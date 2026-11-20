"use client";

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { Loader2, Share2, Trash2, Users } from "lucide-react";
import { inviteMember, listMembers, removeMember, type MemberRow } from "@/lib/sharing/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { timeAgo } from "@/lib/time";

// Share button + dialog. Owners invite by email and manage members; members just see that it's shared.
export default function ShareButton({ serviceId, isOwner }: { serviceId: string; isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [inviting, startInvite] = useTransition();

  const load = useCallback(async () => {
    try {
      setMembers(await listMembers(serviceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load members.");
    }
  }, [serviceId]);

  useEffect(() => {
    if (open && isOwner) load();
  }, [open, isOwner, load]);

  function close() {
    setOpen(false);
    setEmail("");
    setError(null);
    setNotice(null);
  }

  function invite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    startInvite(async () => {
      const res = await inviteMember(serviceId, email);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.member) {
        setMembers((prev) => [...(prev ?? []), res.member!]);
        setNotice(`Added ${res.member.email}.`);
      }
      setEmail("");
    });
  }

  async function remove(userId: string) {
    setError(null);
    setNotice(null);
    setRemoving(userId);
    try {
      await removeMember(serviceId, userId);
      setMembers((prev) => (prev ?? []).filter((m) => m.user_id !== userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove member.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Share2 size={14} />
        Share
      </Button>
      <Dialog open={open} onClose={close} title="Share service">
        {isOwner ? (
          <>
            <form onSubmit={invite}>
              <Label htmlFor="share-email">Invite by email</Label>
              <div className="flex gap-2">
                <Input
                  id="share-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="off"
                />
                <Button type="submit" size="md" variant="primary" disabled={inviting || !email.trim()}>
                  {inviting && <Loader2 size={14} className="animate-spin" />}
                  Invite
                </Button>
              </div>
              <p className="mt-1.5 text-[12px] text-muted">
                Members can view and edit this service and its devices. They can&apos;t delete it or manage members.
              </p>
            </form>
            {error && <p className="mt-2 text-[13px] text-[#ff8a8e]">{error}</p>}
            {notice && <p className="mt-2 text-[13px] text-accent">{notice}</p>}

            <h3 className="mt-5 mb-2 text-[13px] font-medium text-muted">Members</h3>
            {members === null ? (
              <p className="flex items-center gap-2 text-[13px] text-muted">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </p>
            ) : members.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted">
                Not shared with anyone yet.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {members.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px]">{m.email}</p>
                      <p className="text-[12px] text-muted" title={new Date(m.created_at).toLocaleString()}>
                        Added {timeAgo(m.created_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(m.user_id)}
                      disabled={removing === m.user_id}
                      aria-label={`Remove ${m.email}`}
                      title="Remove"
                    >
                      {removing === m.user_id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted">
              <Users size={15} />
            </span>
            <p className="text-[13px] text-muted">
              This service was shared with you. You can view and edit it and its devices. Only the owner can invite
              or remove members.
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}
