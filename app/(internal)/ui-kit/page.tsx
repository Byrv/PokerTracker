import { Coins, HandCoins, Receipt, Trophy } from 'lucide-react';

import { ChipAmount } from '@/components/shared/chip-amount';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { HouseControls } from '@/components/shared/house-controls';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { MoneyAmount } from '@/components/shared/money-amount';
import { PlayerAvatar } from '@/components/shared/player-avatar';
import { PlayerRow } from '@/components/shared/player-row';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { ConfirmDialogDemo } from './confirm-dialog-demo';
import { ThemeToggle } from './theme-toggle';

export const metadata = {
  title: 'UI kit · Poker Tracker',
  robots: { index: false, follow: false },
};

const sampleUsers = [
  { nickname: 'Aman Sharma' },
  { nickname: 'Ravi Kapoor' },
  { nickname: 'Priya Iyer' },
  { nickname: 'Sahil Khan' },
] as const;

export default function UIKitPage() {
  return (
    <TooltipProvider>
      <div className="bg-background text-foreground min-h-svh">
        <header className="border-b">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6">
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight">UI kit</h1>
              <p className="text-muted-foreground text-sm">
                Visual catalog of every primitive and shared component. Internal — not linked from
                the app.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
          <Section title="Money + chips" description="Single source of truth for monetary display.">
            <Card>
              <CardContent className="flex flex-col gap-3 pt-4">
                <div className="flex flex-wrap items-baseline gap-6">
                  <MoneyAmount value={5_00_00} variant="profit" size="lg" showSign />
                  <MoneyAmount value={-3_50_00} variant="loss" size="lg" />
                  <MoneyAmount value={0} size="lg" />
                </div>
                <div className="flex flex-wrap items-baseline gap-6">
                  <MoneyAmount value={12345} variant="auto" />
                  <MoneyAmount value={-12345} variant="auto" />
                  <MoneyAmount value={0} variant="auto" size="sm" />
                </div>
                <Separator />
                <div className="flex flex-wrap items-baseline gap-6">
                  <ChipAmount value={250} />
                  <ChipAmount value={5_000} size="lg" />
                  <ChipAmount value={42_500} showSuffix={false} />
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section title="Player rows + avatars">
            <Card>
              <CardContent className="divide-y pt-4">
                {sampleUsers.map((user, i) => (
                  <PlayerRow
                    key={user.nickname}
                    user={user}
                    highlight={i === 0}
                    hint={i === 0 ? 'You · 2 sessions' : `${3 - (i % 3)} sessions`}
                    amount={
                      <MoneyAmount
                        value={[15_000_00, -7_500_00, 2_500_00, -1_000_00][i] ?? 0}
                        variant="auto"
                      />
                    }
                  />
                ))}
              </CardContent>
            </Card>
            <div className="flex flex-wrap items-end gap-4">
              <PlayerAvatar user={{ nickname: 'Aman Sharma' }} size="sm" />
              <PlayerAvatar user={{ nickname: 'Ravi Kapoor' }} size="md" />
              <PlayerAvatar user={{ nickname: 'Priya Iyer' }} size="lg" />
              <Avatar className="size-10">
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
            </div>
          </Section>

          <Section title="Buttons">
            <div className="flex flex-wrap gap-3">
              <Button>Default</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra small</Button>
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Coins">
                <Coins />
              </Button>
              <Button disabled>Disabled</Button>
            </div>
          </Section>

          <Section title="Forms">
            <Card>
              <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input id="nickname" placeholder="Aman" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ratio">Chip ratio</Label>
                  <Select defaultValue="1">
                    <SelectTrigger id="ratio" className="w-full">
                      <SelectValue placeholder="Select ratio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 chip = ₹1</SelectItem>
                      <SelectItem value="5">1 chip = ₹5</SelectItem>
                      <SelectItem value="10">1 chip = ₹10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" placeholder="Add a note for this session…" />
                </div>
                <div className="flex items-center justify-between md:col-span-2">
                  <Label htmlFor="auto-close">Auto-close at midnight</Label>
                  <Switch id="auto-close" defaultChecked />
                </div>
                <div className="flex items-center gap-3 md:col-span-2">
                  <Toggle aria-label="Toggle bold">B</Toggle>
                  <Toggle aria-label="Toggle italic">I</Toggle>
                  <Toggle aria-label="Toggle underline">U</Toggle>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section title="Cards + badges">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Sessions today</CardTitle>
                  <CardDescription>Live ledger</CardDescription>
                </CardHeader>
                <CardContent className="flex items-baseline gap-3">
                  <MoneyAmount value={12_500_00} variant="profit" size="lg" />
                  <Badge>open</Badge>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>House view</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge>default</Badge>
                  <Badge variant="secondary">secondary</Badge>
                  <Badge variant="destructive">destructive</Badge>
                  <Badge variant="outline">outline</Badge>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="Tabs">
            <Tabs defaultValue="ledger">
              <TabsList>
                <TabsTrigger value="ledger">Ledger</TabsTrigger>
                <TabsTrigger value="settle">Settle up</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="ledger" className="pt-4">
                <p className="text-muted-foreground text-sm">Live buy-ins + cash-outs go here.</p>
              </TabsContent>
              <TabsContent value="settle" className="pt-4">
                <p className="text-muted-foreground text-sm">Net debts / payments.</p>
              </TabsContent>
              <TabsContent value="history" className="pt-4">
                <p className="text-muted-foreground text-sm">Past sessions list.</p>
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Table">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-right">Buy-in</TableHead>
                      <TableHead className="text-right">Cash-out</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      [10_000_00, 22_500_00],
                      [10_000_00, 7_500_00],
                      [5_000_00, 6_000_00],
                    ].map(([buyin, cashout], i) => {
                      const safeBuyin = buyin ?? 0;
                      const safeCashout = cashout ?? 0;
                      const net = safeCashout - safeBuyin;
                      const user = sampleUsers[i] ?? sampleUsers[0];
                      return (
                        <TableRow key={user.nickname}>
                          <TableCell>{user.nickname}</TableCell>
                          <TableCell className="text-right">
                            <MoneyAmount value={safeBuyin} size="sm" />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyAmount value={safeCashout} size="sm" />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyAmount value={net} variant="auto" size="sm" showSign />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Section>

          <Section title="Overlays">
            <div className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger render={<Button>Open dialog</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record a buy-in</DialogTitle>
                    <DialogDescription>
                      Buy-ins are added to the player&apos;s ledger immediately.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (chips)</Label>
                    <Input id="amount" inputMode="numeric" defaultValue="1000" />
                  </div>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline">Cancel</Button>} />
                    <Button>Record</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Sheet>
                <SheetTrigger render={<Button variant="outline">Open sheet</Button>} />
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>Narrow the leaderboard.</SheetDescription>
                  </SheetHeader>
                  <div className="space-y-4 p-4">
                    <Label>Range</Label>
                    <Select defaultValue="month">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Last 7 days</SelectItem>
                        <SelectItem value="month">Last 30 days</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </SheetContent>
              </Sheet>

              <ConfirmDialogDemo />

              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost">Menu</Button>} />
                <DropdownMenuContent>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <HandCoins className="size-4" /> Record buy-in
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Receipt className="size-4" /> View ledger
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">Close session</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Popover>
                <PopoverTrigger render={<Button variant="outline">Popover</Button>} />
                <PopoverContent>
                  <p className="text-sm">Quick info about the row.</p>
                </PopoverContent>
              </Popover>

              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost">Hover me</Button>} />
                <TooltipContent>Tabular numbers align in the ledger.</TooltipContent>
              </Tooltip>
            </div>
          </Section>

          <Section title="States">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-4">
                  <EmptyState
                    icon={<Trophy className="size-10" />}
                    title="No sessions yet"
                    description="Create your first session to start tracking buy-ins and cash-outs."
                    cta={<Button>Start a session</Button>}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  {/* No `retry` here: this catalog page is a Server Component,
                      so we can't ship a closure to the client ErrorState. The
                      shape with a retry button is exercised in unit tests. */}
                  <ErrorState error={new Error('Could not load leaderboard')} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Skeletons</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <LoadingSkeleton variant="card" />
                  <LoadingSkeleton variant="table" count={3} />
                </CardContent>
              </Card>
              <HouseControls isHouse>
                <h3 className="font-heading mb-2 text-base font-medium">House controls</h3>
                <p className="text-muted-foreground mb-3 text-sm">
                  Visible only to the session host.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Record buy-in</Button>
                  <Button size="sm" variant="outline">
                    Approve cash-outs (2)
                  </Button>
                </div>
              </HouseControls>
            </div>
          </Section>

          <Section title="Progress + scroll">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cash-out queue</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={66} />
                  <p className="text-muted-foreground mt-2 text-xs">2 of 3 approved</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Scroll area</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-32 pr-3">
                    <ol className="space-y-2 text-sm">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <li key={i}>
                          Row #{i + 1} — buy-in <MoneyAmount value={(i + 1) * 1_000_00} size="sm" />
                        </li>
                      ))}
                    </ol>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </Section>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3" aria-labelledby={slugify(title)}>
      <header>
        <h2 id={slugify(title)} className="font-heading text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// `AlertDialog` is re-exported here only so the kit page imports the
// primitive once — keeps the catalog usable as a primitives index.
void AlertDialog;
