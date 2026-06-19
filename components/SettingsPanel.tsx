"use client";

import { KeyRound, Loader2, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { SettingsPanelSkeleton } from "@/components/LoadingSkeletons";
import { PasswordInput } from "@/components/PasswordInput";

type Settings = {
  proof_retention_days: number;
};

const fallback: Settings = {
  proof_retention_days: 180
};

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentAccessCode, setCurrentAccessCode] = useState("");
  const [newAccessCode, setNewAccessCode] = useState("");
  const [confirmAccessCode, setConfirmAccessCode] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Settings could not load.");
          return;
        }
        setSettings({ ...fallback, ...payload.settings });
      } catch {
        setError("Settings could not load. Check the server connection.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newAccessCode && newAccessCode !== confirmAccessCode) {
      setError("New access codes do not match.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...settings,
        current_access_code: newAccessCode ? currentAccessCode : undefined,
        new_access_code: newAccessCode || undefined
      })
    });
    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(payload.error || "Settings could not be saved.");
      return;
    }

    setSettings({ ...fallback, ...payload.settings });
    setCurrentAccessCode("");
    setNewAccessCode("");
    setConfirmAccessCode("");
    setMessage(newAccessCode ? "Settings saved and access code changed." : "Settings saved.");
  }

  if (isLoading) {
    return <SettingsPanelSkeleton />;
  }

  return (
    <form onSubmit={save} className="mx-auto grid max-w-3xl min-w-0 gap-5">
      <div className="min-w-0">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-pool">Global controls</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">Settings</h1>
      </div>

      <section className="min-w-0 rounded border border-line bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound size={20} className="text-pool" />
          <h2 className="text-xl font-bold text-ink">Teacher access code</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-graphite sm:col-span-2">
            Current access code
            <PasswordInput
              autoComplete="current-password"
              value={currentAccessCode}
              onChange={(event) => setCurrentAccessCode(event.target.value)}
              className="focus-ring min-h-12 min-w-0 rounded border border-line bg-paper px-3 py-3 text-ink"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-graphite">
            New access code
            <PasswordInput
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={newAccessCode}
              onChange={(event) => setNewAccessCode(event.target.value)}
              className="focus-ring min-h-12 min-w-0 rounded border border-line bg-paper px-3 py-3 text-ink"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-graphite">
            Confirm new access code
            <PasswordInput
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={confirmAccessCode}
              onChange={(event) => setConfirmAccessCode(event.target.value)}
              className="focus-ring min-h-12 min-w-0 rounded border border-line bg-paper px-3 py-3 text-ink"
            />
          </label>
        </div>
      </section>

      <section className="min-w-0 rounded border border-line bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-xl font-bold text-ink">Proof photos</h2>
        <div className="grid gap-4">
          <label className="grid max-w-sm gap-2 text-sm font-semibold text-graphite">
            Delete proof photos after (days)
            <input
              type="number"
              min={30}
              max={3650}
              value={settings.proof_retention_days}
              onChange={(event) => setSettings({ ...settings, proof_retention_days: Number(event.target.value) })}
              className="focus-ring min-h-12 min-w-0 rounded border border-line bg-paper px-3 py-3 text-ink"
            />
          </label>
        </div>
      </section>

      {error ? <p className="rounded border border-signal bg-red-50 px-3 py-2 text-sm font-semibold text-signal">{error}</p> : null}
      {message ? <p className="rounded border border-ledger bg-green-50 px-3 py-2 text-sm font-semibold text-ledger">{message}</p> : null}

      <button disabled={saving} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded bg-ledger px-5 py-3 font-bold text-white transition hover:bg-ink disabled:opacity-60">
        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
        Save settings
      </button>
    </form>
  );
}
