import { CreateSessionForm } from './form';

export default function NewSessionPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <h1 className="text-xl font-semibold">New session</h1>
      <p className="text-sm text-[var(--foreground)]/70">
        You will be added as the house and as a participant. Invite players from the session screen.
      </p>
      <CreateSessionForm />
    </div>
  );
}
