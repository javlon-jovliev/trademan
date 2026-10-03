"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uz } from "@/i18n/dictionaries";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            const r = await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Object.fromEntries(f)),
            });
            if (!r.ok) throw Error((await r.json()).error);
            router.push("/dashboard");
            router.refresh();
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="brand">
          <span className="logo">e</span>
          <strong>ERTA</strong>
        </div>
        <label>
          {uz.username}
          <input name="username" autoComplete="username" required />
        </label>
        <label>
          {uz.password}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert" className="negative">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? uz.loading : uz.login}
        </button>
      </form>
    </main>
  );
}
