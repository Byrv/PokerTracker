'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

type Point = { at: string; cumulativeNetPaise: number };

/**
 * Renders the player's cumulative bankroll over time. Series values arrive
 * in paise; we plot rupees so axis labels stay readable.
 */
export function BankrollChart({ series }: { series: ReadonlyArray<Point> }) {
  if (series.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No closed sessions yet — your bankroll curve will appear here.
      </p>
    );
  }

  const data = series.map((p) => ({
    at: p.at,
    rupees: p.cumulativeNetPaise / 100,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <XAxis
            dataKey="at"
            tickFormatter={(value: string) => value.slice(5)}
            fontSize={12}
            stroke="currentColor"
            tickLine={false}
          />
          <YAxis
            fontSize={12}
            stroke="currentColor"
            tickLine={false}
            width={56}
            tickFormatter={(value: number) => inrFormatter.format(value)}
          />
          <Tooltip
            formatter={(value) => inrFormatter.format(typeof value === 'number' ? value : 0)}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="rupees"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
