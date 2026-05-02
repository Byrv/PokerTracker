import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Award,
  Crown,
  Flame,
  Medal,
  Repeat,
  Sparkles,
  Star,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState, MoneyAmount, PlayerAvatar } from '@/components/shared';
import { getModules } from '@/lib/modules';
import { asUserId } from '@/lib/modules/core';

import { BankrollChart } from './bankroll-chart';

type BadgeMeta = { icon: LucideIcon; label: string; rule: string };

const BADGE_REGISTRY: Record<string, BadgeMeta> = {
  first_session: {
    icon: Sparkles,
    label: 'First Session',
    rule: 'Played in your very first poker session.',
  },
  streak_10: {
    icon: Flame,
    label: 'Hot Streak',
    rule: 'Won net positive in 10 sessions in a row.',
  },
  biggest_pot: {
    icon: Trophy,
    label: 'Biggest Pot',
    rule: 'Took down the largest single pot of a night.',
  },
  comeback_kid: {
    icon: Repeat,
    label: 'Comeback Kid',
    rule: 'Recovered from down >50% of buy-ins to finish positive.',
  },
};

const FALLBACK_ICONS: ReadonlyArray<LucideIcon> = [Award, Medal, Star, Target, Crown];

function metaForBadge(key: string, index: number): BadgeMeta {
  const known = BADGE_REGISTRY[key];
  if (known) return known;
  const Icon = FALLBACK_ICONS[index % FALLBACK_ICONS.length] ?? Award;
  return {
    icon: Icon,
    label: key
      .split('_')
      .map((part) => (part.length > 0 ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part))
      .join(' '),
    rule: 'Earned through gameplay.',
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatPlayedOn(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function formatStreak(streak: number): string {
  if (streak === 0) return 'No active streak';
  const direction = streak > 0 ? 'win' : 'loss';
  const count = Math.abs(streak);
  return `${count} ${direction}${count === 1 ? '' : 's'} in a row`;
}

export default async function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { profiles } = await getModules();

  let summary;
  try {
    summary = await profiles.getProfile(asUserId(userId));
  } catch {
    notFound();
  }

  const lifetimeNet = summary.lifetime.netPaise;
  const lifetimeVariant: 'profit' | 'loss' | 'neutral' =
    lifetimeNet > 0 ? 'profit' : lifetimeNet < 0 ? 'loss' : 'neutral';

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <PlayerAvatar user={summary.user} size="lg" />
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold">{summary.user.nickname}</h1>
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              Lifetime net
            </span>
            <MoneyAmount value={lifetimeNet} variant={lifetimeVariant} size="lg" showSign />
          </div>
        </div>
      </header>

      {/* Lifetime stats */}
      <Card>
        <CardHeader>
          <CardTitle>Lifetime stats</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">
              Sessions played
            </div>
            <div className="text-foreground text-lg font-semibold tabular-nums">
              {summary.lifetime.sessionsPlayed}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">Biggest win</div>
            <MoneyAmount value={summary.lifetime.biggestWinPaise} variant="profit" size="md" />
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">
              Biggest loss
            </div>
            <MoneyAmount value={summary.lifetime.biggestLossPaise} variant="loss" size="md" />
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">
              Current streak
            </div>
            <div className="text-foreground text-base font-medium">
              {formatStreak(summary.lifetime.currentStreak)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bankroll chart */}
      <Card>
        <CardHeader>
          <CardTitle>Bankroll over time</CardTitle>
        </CardHeader>
        <CardContent>
          <BankrollChart series={summary.bankrollSeries} />
        </CardContent>
      </Card>

      {/* Badges grid */}
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.badges.length === 0 ? (
            <p className="text-muted-foreground text-sm">No badges earned yet.</p>
          ) : (
            <TooltipProvider>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {summary.badges.map((badge, index) => {
                  const meta = metaForBadge(badge.key, index);
                  const Icon = meta.icon;
                  const earnedOn = formatPlayedOn(badge.earnedAt);
                  const card = (
                    <div className="bg-card ring-foreground/10 flex h-full flex-col items-center justify-center gap-2 rounded-xl p-4 text-center ring-1">
                      <Icon className="text-accent size-8" aria-hidden />
                      <div className="text-foreground text-sm font-medium">{meta.label}</div>
                      <div className="text-muted-foreground text-xs">{earnedOn}</div>
                    </div>
                  );
                  return (
                    <li key={`${badge.key}-${badge.earnedAt}`}>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            badge.sessionId ? (
                              <Link
                                href={`/sessions/${badge.sessionId}`}
                                aria-label={`${meta.label}: ${meta.rule}`}
                                className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                              >
                                {card}
                              </Link>
                            ) : (
                              <div
                                aria-label={`${meta.label}: ${meta.rule}`}
                                className="block rounded-xl"
                              >
                                {card}
                              </div>
                            )
                          }
                        />
                        <TooltipContent>{meta.rule}</TooltipContent>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Session history */}
      <Card>
        <CardHeader>
          <CardTitle>Session history</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.history.length === 0 ? (
            <EmptyState
              title="No sessions played yet"
              description="Once a session closes, it will show up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.history.map((row) => {
                  const variant: 'profit' | 'loss' | 'neutral' =
                    row.netPaise > 0 ? 'profit' : row.netPaise < 0 ? 'loss' : 'neutral';
                  return (
                    <TableRow key={row.sessionId}>
                      <TableCell className="text-muted-foreground">
                        {formatPlayedOn(row.playedOn)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/sessions/${row.sessionId}`}
                          className="text-foreground hover:underline focus-visible:underline"
                        >
                          {row.playedOn}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyAmount value={row.netPaise} variant={variant} size="sm" showSign />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
