"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" style={{ color: "var(--cream-mute)" }}>Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [password, setPassword] = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (r.ok) { window.location.href = next; }
      else { setError("Wrong password."); setBusy(false); }
    } catch (e) { setError(String(e)); setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-sm rounded-2xl p-8"
        style={{ border: "1px solid var(--line)" }}
      >
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-white"
            style={{ background: "linear-gradient(140deg, var(--gold), var(--rust))" }}>
            <Lock size={20} />
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--cream-mute)" }}>
            Local · Bangkok
          </div>
          <div className="text-[22px] tracking-tight mt-0.5" style={{ fontFamily: "var(--font-bricolage)", color: "var(--cream)" }}>
            Agentic <span className="hand text-[1.3em] ml-1" style={{ color: "var(--gold)" }}>OS</span>
          </div>
        </div>

        <input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border px-3 py-2.5 text-[14px] outline-none"
          style={{ background: "rgba(0,0,0,0.3)", borderColor: "var(--line)", color: "var(--cream)", caretColor: "var(--gold)" }}
        />

        {error && (
          <p className="mt-3 text-center text-[12px]" style={{ color: "var(--plum)" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={!password || busy}
          className="mt-4 w-full rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-40"
          style={{ background: "linear-gradient(140deg, var(--gold), var(--rust))" }}
        >
          {busy ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Sign in"}
        </button>
      </motion.form>
    </div>
  );
}
