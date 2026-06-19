import { LoginForm } from "@/components/LoginForm";
import { Gauge } from "lucide-react";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";
  const error = params.error === "rate" ? "Too many login attempts. Try again in 15 minutes." : params.error ? "The access code is not correct." : "";

  return (
    <main className="grid min-h-screen place-items-center px-3 py-6 sm:px-4 sm:py-10">
      <section className="w-full max-w-md rounded border border-line bg-white/95 p-4 shadow-soft sm:p-6">
        <div className="mb-5 border-b border-line pb-4 sm:mb-7 sm:pb-5">
          <div className="mb-5 inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded border border-line bg-paper text-ink">
              <Gauge size={20} />
            </span>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-pool">CBA Attendance Log</p>
          </div>
          <h1 className="text-3xl font-bold leading-tight text-ink sm:text-4xl">Teacher login</h1>
          <p className="mt-2 text-sm text-graphite">Enter the private access code to manage sections, subjects, and attendance.</p>
        </div>
        <LoginForm nextPath={nextPath} error={error} />
      </section>
    </main>
  );
}
