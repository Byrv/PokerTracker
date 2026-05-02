'use client';

import { useState } from 'react';
import { Copy, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * House-only invite panel: shows the share-able join URL and lets the
 * house copy or hand it off via the platform share sheet. Players who
 * follow the link are signed in (if needed) and auto-added as participants
 * via the join_session_with_token RPC.
 */
export function InvitePanel({
  sessionName,
  inviteUrl,
}: {
  sessionName?: string;
  inviteUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / restricted contexts: select the input as a fallback.
      const el = document.getElementById('invite-url-input') as HTMLInputElement | null;
      el?.select();
      document.execCommand?.('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const share = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: sessionName ? `Join ${sessionName}` : 'Join my poker session',
          text: "You're invited to a poker session — tap to join.",
          url: inviteUrl,
        });
      } catch {
        /* user dismissed share sheet — no-op */
      }
    } else {
      copy();
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Invite players</h3>
      <p className="text-xs text-[var(--foreground)]/70">
        Anyone with this link who&apos;s signed in joins the session automatically.
      </p>
      <div className="space-y-2">
        <Label htmlFor="invite-url-input" className="sr-only">
          Invite URL
        </Label>
        <div className="flex gap-2">
          <Input
            id="invite-url-input"
            readOnly
            value={inviteUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={copy} aria-label="Copy invite URL">
            <Copy className="size-4" />
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={share} aria-label="Share invite">
            <Share2 className="size-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
