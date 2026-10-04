"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { valueExplanation } from "@/risk/definitions";
const HelpContext = createContext({
  language: "uz" as "uz" | "en",
  currency: "USD",
  timezone: "America/New_York",
});
export function HelpProvider({
  language,
  currency,
  timezone,
  children,
}: {
  language: "uz" | "en";
  currency?: string;
  timezone?: string;
  children: ReactNode;
}) {
  return (
    <HelpContext.Provider
      value={{
        language,
        currency: currency ?? "USD",
        timezone: timezone ?? "America/New_York",
      }}
    >
      {children}
    </HelpContext.Provider>
  );
}
export function ValueHelp({
  label,
  children,
  icon = false,
  help,
}: {
  label?: string;
  children: ReactNode;
  icon?: boolean;
  help?: string;
}) {
  const context = useContext(HelpContext);
  const text =
    help ??
    (label
      ? valueExplanation(
          label,
          context.language,
          context.currency,
          context.timezone,
        )
      : undefined);
  const id = useId(),
    ref = useRef<HTMLSpanElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [point, setPoint] = useState<{
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPoint(null), 180);
  };
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !text) return;
    const width = Math.min(300, window.innerWidth - 24);
    const above = rect.bottom + 160 > window.innerHeight && rect.top > 160;
    setPoint({
      left: Math.min(
        window.innerWidth - width - 12,
        Math.max(12, rect.left + rect.width / 2 - width / 2),
      ),
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
    });
  };
  useEffect(() => {
    if (!point) return;
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPoint(null);
    };
    const scroll = () => setPoint(null);
    document.addEventListener("keydown", dismiss);
    window.addEventListener("resize", scroll);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("keydown", dismiss);
      window.removeEventListener("resize", scroll);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [point]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  if (!text) return <>{children}</>;
  return (
    <span
      className={`value-help ${icon ? "with-help-icon" : ""}`}
      ref={ref}
      onPointerEnter={show}
      onPointerLeave={close}
      onFocus={show}
      onBlur={close}
      tabIndex={icon ? undefined : 0}
      aria-describedby={point ? id : undefined}
    >
      {children}
      {icon && (
        <button
          type="button"
          className="help-trigger"
          aria-label={`${context.language === "uz" ? "Izoh" : "About"}: ${label}`}
          aria-describedby={point ? id : undefined}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            show();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") setPoint(null);
          }}
        >
          <Info size={13} aria-hidden="true" />
        </button>
      )}
      {point &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            className="value-tooltip"
            style={{
              left: point.left,
              top: point.top,
              transform: point.above ? "translateY(-100%)" : undefined,
            }}
            onPointerEnter={() => {
              if (timer.current) clearTimeout(timer.current);
            }}
            onPointerLeave={close}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
