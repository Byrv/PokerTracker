'use client';

import { useMemo, useState, useTransition } from 'react';
import { UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PlayerAvatar } from '@/components/shared/player-avatar';

import { addParticipantAction, removeParticipantAction } from '../actions';

type User = { id: string; nickname: string; avatarUrl?: string };

/**
 * House-only participant manager: lists current participants with a
 * Remove button, and a "+ Add" dialog that lets the house pick from the
 * roster of all users (filtered by a search box). Creator can't remove
 * themselves; closed sessions show the list read-only.
 */
export function ParticipantsManager({
  sessionId,
  isHouse,
  isOpen,
  creatorId,
  participants,
  candidates,
}: {
  sessionId: string;
  isHouse: boolean;
  isOpen: boolean;
  creatorId: string;
  participants: User[];
  candidates: User[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((u) => u.nickname.toLowerCase().includes(q));
  }, [candidates, query]);

  const add = (userId: string) =>
    startTransition(async () => {
      try {
        await addParticipantAction({ sessionId, userId });
        setPickerOpen(false);
        setQuery('');
      } catch {
        /* error already surfaced via revalidate / boundary throw */
      }
    });

  const remove = (userId: string) =>
    startTransition(async () => {
      await removeParticipantAction({ sessionId, userId });
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Participants ({participants.length})</h3>
        {isHouse && isOpen ? (
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm">
                  <UserPlus className="size-4" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a player</DialogTitle>
                <DialogDescription>
                  Pick from existing users. They join immediately — no invite link needed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input
                  placeholder="Search by nickname"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[var(--foreground)]/70">
                    {candidates.length === 0
                      ? 'Everyone is already in the session.'
                      : 'No users match.'}
                  </p>
                ) : (
                  <ul className="max-h-60 divide-y divide-[var(--border)] overflow-auto">
                    {filtered.map((u) => (
                      <li key={u.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar user={u} size="sm" />
                          <span className="text-sm">{u.nickname}</span>
                        </div>
                        <Button size="sm" disabled={isPending} onClick={() => add(u.id)}>
                          Add
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPickerOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      {participants.length === 0 ? (
        <p className="text-sm text-[var(--foreground)]/70">No participants yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {participants.map((p) => {
            const isCreator = p.id === creatorId;
            return (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <PlayerAvatar user={p} size="sm" />
                  <span className="text-sm font-medium">{p.nickname}</span>
                  {isCreator ? (
                    <span className="text-xs text-[var(--foreground)]/60">house</span>
                  ) : null}
                </div>
                {isHouse && isOpen && !isCreator ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm" aria-label={`Remove ${p.nickname}`}>
                        <X className="size-4" />
                      </Button>
                    }
                    title={`Remove ${p.nickname}?`}
                    description="They'll lose access to this session. Their existing buy-ins and cash-outs stay in the ledger."
                    confirmLabel="Remove"
                    destructive
                    onConfirm={() => remove(p.id)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
