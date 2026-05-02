import { redirect } from 'next/navigation';

// Temporary band-aid (issue #11): the per-user profile page surfaces a
// runtime error in production we haven't yet diagnosed. Until we ship the
// error-boundary diagnostic + real fix from v1.1/plan-11-12.md, route the
// Profile nav link to /settings so users don't hit the broken page. Direct
// /profile/[userId] URLs still resolve normally.
export default function ProfileRedirect() {
  redirect('/settings');
}
