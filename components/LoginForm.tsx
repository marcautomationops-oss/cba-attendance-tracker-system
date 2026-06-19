import { KeyRound } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";

export function LoginForm({ nextPath, error }: { nextPath: string; error?: string }) {
  return (
    <form action="/api/login" method="post" className="grid gap-4">
      <input type="hidden" name="next" value={nextPath} />
      <label className="grid gap-2 text-sm font-semibold text-graphite">
        Teacher access code
        <PasswordInput
          name="accessCode"
          className="focus-ring min-h-12 rounded border border-line bg-paper px-4 py-3 text-base font-bold text-ink shadow-sm"
          autoComplete="current-password"
          autoFocus
          required
        />
      </label>
      {error ? <p className="rounded border border-signal bg-red-50 px-3 py-2 text-sm font-semibold text-signal">{error}</p> : null}
      <button
        type="submit"
        className="focus-ring inline-flex items-center justify-center gap-2 rounded bg-ledger px-5 py-3 font-bold text-white transition hover:bg-ink"
      >
        <KeyRound size={18} />
        Open dashboard
      </button>
    </form>
  );
}
