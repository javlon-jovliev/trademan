"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useSessionActivity() {
  const router = useRouter();
  useEffect(() => {
    let lastSent = 0;
    let busy = false;
    const controller = new AbortController();
    const activity = async (event: Event) => {
      if (
        !event.isTrusted ||
        document.visibilityState !== "visible" ||
        busy ||
        Date.now() - lastSent < 30000
      )
        return;
      busy = true;
      lastSent = Date.now();
      try {
        const response = await fetch("/api/session/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) router.replace("/login");
      } catch {
        // Network failure does not extend the server's session deadline.
      } finally {
        busy = false;
      }
    };
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
      "touchstart",
    ];
    for (const event of events)
      window.addEventListener(event, activity, { passive: true });
    return () => {
      controller.abort();
      for (const event of events) window.removeEventListener(event, activity);
    };
  }, [router]);
}
