import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getModules } from '@/lib/modules';

import { ChipRatioForm } from './chip-ratio-form';
import { ProfileForm } from './profile-form';
import { signOutAction } from './actions';
import { SettingsThemeToggle } from './theme-toggle';

export const metadata = {
  title: 'Settings — Poker Tracker',
};

export default async function SettingsPage() {
  const { auth, core } = await getModules();
  // Sequential, NOT Promise.all — calling auth.getUser() concurrently with
  // another DB query can race the @supabase/ssr token-refresh path. The
  // refresh writes new tokens to in-memory state but Server Components can't
  // persist them to cookies, so a parallel query that triggers its own
  // refresh attempts to use the now-consumed refresh token and fails with
  // not_authenticated. Serializing the auth check makes the refresh complete
  // (in-memory) before any sibling query starts.
  const me = await auth.requireUser();
  const ratio = await core.getChipRatio();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile, app preferences, and session settings.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            How other players see you in sessions and on the leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultNickname={me.nickname} defaultAvatarUrl={me.avatarUrl ?? ''} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>App settings</CardTitle>
          <CardDescription>
            Global chip ratio used when starting new sessions. Updates may be restricted to the
            house — failures will appear below the form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChipRatioForm defaultChipsPerPaise={ratio.chipsPerPaise} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Pick a theme for this device. System follows your OS setting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in as {me.email}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
