"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { SettingsPanelSkeleton } from "@/components/LoadingSkeletons";

type Settings = {
  default_late_limit: number;
  default_absent_limit: number;
  default_automatic_sms: boolean;
  proof_retention_days: number;
  storage_warning_mb: number;
};

const fallback: Settings = {
  default_late_limit: 3,
  default_absent_limit: 2,
  default_automatic_sms: false,
  proof_retention_days: 180,
  storage_warning_mb: 750
};

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings)
    });
    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(payload.error || "Settings could not be saved.");
      return;
    }

    setSettings({ ...fallback, ...payload.settings });
    setMessage("Settings saved.");
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
        <h2 className="mb-4 text-xl font-bold text-ink">SMS alerts</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-graphite">
            Default late limit
            <input
              type="number"
              min={1}
              value={settings.default_late_limit}
              onChange={(event) => setSettings({ ...settings, default_late_limit: Number(event.target.value) })}
              className="focus-ring min-h-12 min-w-0 rounded border border-line bg-paper px-3 py-3 text-ink"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-graphite">
            Default absent limit
            <input
              type="number"
              min={1}
              value={settings.default_absent_limit}
              onChange={(event) => setSettings({ ...settings, default_absent_limit: Number(event.target.value) })}
              className="focus-ring min-h-12 min-w-0 rounded border border-line bg-paper px-3 py-3 text-ink"
            />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded border border-line bg-paper px-3 py-3 text-sm font-semibold text-graphite sm:col-span-2">
            Default automatic SMS
            <input
              type="checkbox"
              checked={settings.default_automatic_sms}
              onChange={(event) => setSettings({ ...settings, default_automatic_sms: event.target.checked })}
              className="h-5 w-5"
            />
          </label>
        </div>
      </section>

      <section className="min-w-0 rounded border border-line bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-xl font-bold text-ink">Storage</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-graphite">
            Proof retention days
            <input
              type="number"
              min={30}
              value={settings.proof_retention_days}
              onChange={(event) => setSettings({ ...settings, proof_retention_days: Number(event.target.value) })}
              className="focus-ring min-h-12 min-w-0 rounded border border-line bg-paper px-3 py-3 text-ink"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-graphite">
            Storage warning MB
            <input
              type="number"
              min={100}
              value={settings.storage_warning_mb}
              onChange={(event) => setSettings({ ...settings, storage_warning_mb: Number(event.target.value) })}
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
