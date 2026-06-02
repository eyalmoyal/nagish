"use client";

/**
 * AccessibilityWidget
 * ----------------------------------------------------------------------------
 * A floating, RTL-first user-preference panel for React / Next.js (app router).
 *
 * What it is:  a USER-PREFERENCE tool. It lets a visitor tweak how a page looks
 *              in THEIR browser (text size, contrast, font, link highlighting,
 *              animations).
 * What it is NOT:  an "accessibility overlay". It does not auto-fix markup,
 *              inject alt text/ARIA, or make any compliance claim. By design.
 *
 * How effects apply:  the widget only ever toggles classes and one CSS custom
 *              property on <html> (document.documentElement). The visual effect
 *              of those switches lives in `a11y-widget-host.css`, which the host
 *              site imports. The widget never touches individual host elements.
 *
 * The widget's OWN UI is built to be flawlessly accessible: real <button>s with
 * aria state, a focus-trapped role="dialog", Esc-to-close with focus return,
 * visible focus rings, logical-property RTL/LTR mirroring, and respect for
 * prefers-reduced-motion. Styles are scoped under `.a11y-widget-root` and reset
 * within scope so nothing leaks in or out.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STRINGS, type Lang, type WidgetStrings } from "./i18n";

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export type WidgetPosition =
  | "bottom-start"
  | "bottom-end"
  | "top-start"
  | "top-end";

export interface AccessibilityWidgetProps {
  /** UI language + base direction. Default "he" (rtl). */
  lang?: Lang;
  /** Corner the floating button sits in. Default "bottom-start". */
  position?: WidgetPosition;
  /** If provided, the statement link points here (opens in a new tab). */
  statementUrl?: string;
  /** Alternative to `statementUrl`: called when the statement link is clicked. */
  onStatementClick?: () => void;
}

/* ------------------------------------------------------------------ */
/* Preferences model + persistence                                     */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "a11y-widget:v1";

const FONT_MIN = 0.8;
const FONT_MAX = 2.0;
const FONT_STEP = 0.1;
const FONT_DEFAULT = 1.0;

/** CSS hooks the host stylesheet (a11y-widget-host.css) responds to. */
const CSS_VAR_FONT_SCALE = "--a11y-font-scale";
const HOST_CLASS = {
  highContrast: "a11y-high-contrast",
  readableFont: "a11y-readable-font",
  highlightLinks: "a11y-highlight-links",
  stopAnimations: "a11y-stop-animations",
} as const;

interface Prefs {
  fontScale: number;
  highContrast: boolean;
  readableFont: boolean;
  highlightLinks: boolean;
  stopAnimations: boolean;
}

const DEFAULT_PREFS: Prefs = {
  fontScale: FONT_DEFAULT,
  highContrast: false,
  readableFont: false,
  highlightLinks: false,
  stopAnimations: false,
};

const clampScale = (n: number): number =>
  Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n * 10) / 10));

/** Read persisted prefs. Guarded for SSR + privacy-blocked storage. */
function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      fontScale:
        typeof parsed.fontScale === "number"
          ? clampScale(parsed.fontScale)
          : DEFAULT_PREFS.fontScale,
      highContrast: !!parsed.highContrast,
      readableFont: !!parsed.readableFont,
      highlightLinks: !!parsed.highlightLinks,
      stopAnimations: !!parsed.stopAnimations,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Persist prefs. Swallows quota / disabled-storage errors. */
function writePrefs(prefs: Prefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable — preferences just won't persist */
  }
}

/**
 * Reflect prefs onto <html> as classes + a custom property. This is the ONLY
 * place the widget touches the host document, and it only ever touches
 * documentElement — never individual host elements.
 */
function applyPrefs(prefs: Prefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (prefs.fontScale !== FONT_DEFAULT) {
    root.style.setProperty(CSS_VAR_FONT_SCALE, String(prefs.fontScale));
  } else {
    root.style.removeProperty(CSS_VAR_FONT_SCALE);
  }

  root.classList.toggle(HOST_CLASS.highContrast, prefs.highContrast);
  root.classList.toggle(HOST_CLASS.readableFont, prefs.readableFont);
  root.classList.toggle(HOST_CLASS.highlightLinks, prefs.highlightLinks);
  root.classList.toggle(HOST_CLASS.stopAnimations, prefs.stopAnimations);
}

/* ------------------------------------------------------------------ */
/* Focus management helpers                                            */
/* ------------------------------------------------------------------ */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (el) =>
      el.offsetWidth > 0 ||
      el.offsetHeight > 0 ||
      el === document.activeElement,
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function AccessibilityGlyph() {
  // Universal "access" person mark. Decorative — the button carries the label.
  return (
    <svg
      className="a11y-icon"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="4" r="2.1" fill="currentColor" />
      <path
        d="M3.5 8.2c0-.7.6-1.2 1.3-1.1 2 .35 4.6.6 7.2.6s5.2-.25 7.2-.6c.7-.1 1.3.4 1.3 1.1 0 .65-.5 1.1-1.1 1.2-1.5.26-3.3.45-5 .53v3.1c0 .5.07 1 .25 1.46l1.9 5.2c.24.66-.1 1.36-.74 1.58-.62.21-1.3-.12-1.53-.78l-1.6-4.6c-.13-.36-.64-.36-.77 0l-1.6 4.6c-.23.66-.9.99-1.53.78-.64-.22-.98-.92-.74-1.58l1.9-5.2c.18-.46.25-.96.25-1.46v-3.1c-1.7-.08-3.5-.27-5-.53-.6-.1-1.1-.55-1.1-1.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface ToggleRowProps {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  onWord: string;
  offWord: string;
}

/** A full-width on/off control. Real <button> with aria-pressed. */
function ToggleRow({ label, pressed, onToggle, onWord, offWord }: ToggleRowProps) {
  return (
    <button
      type="button"
      className="a11y-toggle"
      aria-pressed={pressed}
      onClick={onToggle}
    >
      <span className="a11y-toggle-label">{label}</span>
      <span className="a11y-state" aria-hidden="true">
        {pressed ? onWord : offWord}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AccessibilityWidget({
  lang = "he",
  position = "bottom-start",
  statementUrl,
  onStatementClick,
}: AccessibilityWidgetProps) {
  const t: WidgetStrings = STRINGS[lang] ?? STRINGS.he;

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [announcement, setAnnouncement] = useState("");

  const portalElRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const baseId = useId();
  const dialogId = `${baseId}-dialog`;
  const titleId = `${baseId}-title`;
  const fontStatusId = `${baseId}-fontstatus`;

  /* -- Mount: create portal host, restore prefs, apply them ----------- */
  useEffect(() => {
    const el = document.createElement("div");
    el.className = "a11y-widget-root";
    document.body.appendChild(el);
    portalElRef.current = el;

    const restored = readPrefs();
    setPrefs(restored);
    applyPrefs(restored);

    setMounted(true);

    return () => {
      el.remove();
      portalElRef.current = null;
    };
  }, []);

  /* -- Keep the portal host's dir/position attributes in sync --------- */
  useEffect(() => {
    const el = portalElRef.current;
    if (!el) return;
    el.setAttribute("dir", t.dir);
    el.setAttribute("data-position", position);
    el.lang = lang;
  }, [t.dir, position, lang, mounted]);

  /* -- Persist + apply on every prefs change -------------------------- */
  const commitPrefs = useCallback((next: Prefs) => {
    setPrefs(next);
    applyPrefs(next);
    writePrefs(next);
  }, []);

  /* -- Control handlers ----------------------------------------------- */
  const changeFont = useCallback(
    (delta: number) =>
      setPrefs((prev) => {
        const next = { ...prev, fontScale: clampScale(prev.fontScale + delta) };
        applyPrefs(next);
        writePrefs(next);
        return next;
      }),
    [],
  );

  const resetFont = useCallback(
    () =>
      setPrefs((prev) => {
        const next = { ...prev, fontScale: FONT_DEFAULT };
        applyPrefs(next);
        writePrefs(next);
        return next;
      }),
    [],
  );

  const toggle = useCallback(
    (key: keyof Omit<Prefs, "fontScale">) =>
      setPrefs((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        applyPrefs(next);
        writePrefs(next);
        return next;
      }),
    [],
  );

  const resetAll = useCallback(() => {
    commitPrefs(DEFAULT_PREFS);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    setAnnouncement(t.resetAnnouncement);
    // Clear so the same message can be announced again next time.
    window.setTimeout(() => setAnnouncement(""), 1200);
  }, [commitPrefs, t.resetAnnouncement]);

  /* -- Open / close --------------------------------------------------- */
  const openPanel = useCallback(() => {
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement) ?? triggerRef.current;
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
    // Return focus to the trigger (or wherever it was before opening).
    const target = triggerRef.current ?? previouslyFocusedRef.current;
    target?.focus();
  }, []);

  /* -- When open: move focus in, trap it, wire Esc + outside click ---- */
  useEffect(() => {
    if (!open) return;

    // Move focus into the dialog so the accessible name is announced.
    const id = window.requestAnimationFrame(() => dialogRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
        return;
      }
      if (e.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = getFocusable(dialog);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && dialog.contains(active);

      if (e.shiftKey) {
        if (!inside || active === first || active === dialog) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!inside || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dialogRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closePanel();
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousedown", onPointerDown, true);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [open, closePanel]);

  const fontPercent = Math.round(prefs.fontScale * 100);
  const hasStatement = Boolean(statementUrl || onStatementClick);

  /* SSR / pre-mount: render nothing. Avoids hydration mismatch and any
     window/document access before the portal host exists. */
  if (!mounted || !portalElRef.current) return null;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: WIDGET_CSS }} />

      {/* Floating trigger */}
      <button
        ref={triggerRef}
        type="button"
        className="a11y-trigger"
        aria-label={t.triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => (open ? closePanel() : openPanel())}
      >
        <AccessibilityGlyph />
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={dialogRef}
          id={dialogId}
          className="a11y-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <div className="a11y-header">
            <div className="a11y-titles">
              <h2 id={titleId} className="a11y-title">
                {t.title}
              </h2>
              <p className="a11y-subtitle">{t.subtitle}</p>
            </div>
            <button
              type="button"
              className="a11y-close"
              aria-label={t.close}
              onClick={closePanel}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="a11y-body">
            {/* 1. Font size */}
            <section className="a11y-group" aria-labelledby={`${baseId}-fontlabel`}>
              <h3 id={`${baseId}-fontlabel`} className="a11y-group-label">
                {t.fontSize}
              </h3>
              <div className="a11y-font-row" role="group" aria-labelledby={`${baseId}-fontlabel`}>
                <button
                  type="button"
                  className="a11y-step"
                  aria-label={t.fontDecrease}
                  onClick={() => changeFont(-FONT_STEP)}
                  disabled={prefs.fontScale <= FONT_MIN}
                >
                  <span aria-hidden="true">A−</span>
                </button>
                <button
                  type="button"
                  className="a11y-step a11y-step-reset"
                  aria-label={t.fontReset}
                  onClick={resetFont}
                  disabled={prefs.fontScale === FONT_DEFAULT}
                >
                  <span aria-hidden="true">↺</span>
                </button>
                <button
                  type="button"
                  className="a11y-step"
                  aria-label={t.fontIncrease}
                  onClick={() => changeFont(FONT_STEP)}
                  disabled={prefs.fontScale >= FONT_MAX}
                >
                  <span aria-hidden="true">A+</span>
                </button>
              </div>
              <p
                id={fontStatusId}
                className="a11y-font-status"
                aria-live="polite"
              >
                {t.fontCurrent(fontPercent)}
              </p>
            </section>

            {/* 2–5. Toggles */}
            <section className="a11y-group">
              <ToggleRow
                label={t.highContrast}
                pressed={prefs.highContrast}
                onToggle={() => toggle("highContrast")}
                onWord={t.on}
                offWord={t.off}
              />
              <ToggleRow
                label={t.readableFont}
                pressed={prefs.readableFont}
                onToggle={() => toggle("readableFont")}
                onWord={t.on}
                offWord={t.off}
              />
              <ToggleRow
                label={t.highlightLinks}
                pressed={prefs.highlightLinks}
                onToggle={() => toggle("highlightLinks")}
                onWord={t.on}
                offWord={t.off}
              />
              <ToggleRow
                label={t.stopAnimations}
                pressed={prefs.stopAnimations}
                onToggle={() => toggle("stopAnimations")}
                onWord={t.on}
                offWord={t.off}
              />
            </section>

            {/* 6. Reset all */}
            <section className="a11y-group">
              <button type="button" className="a11y-reset" onClick={resetAll}>
                {t.resetAll}
              </button>
            </section>

            {/* Statement link / slot */}
            {hasStatement && (
              <div className="a11y-statement">
                {statementUrl ? (
                  <a
                    href={statementUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="a11y-statement-link"
                  >
                    {t.statement}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="a11y-statement-link a11y-statement-button"
                    onClick={() => {
                      onStatementClick?.();
                    }}
                  >
                    {t.statement}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Polite live region for reset-all confirmation. */}
          <div className="a11y-sr-only" role="status" aria-live="polite">
            {announcement}
          </div>
        </div>
      )}
    </>,
    portalElRef.current,
  );
}

/* ================================================================== */
/* Scoped widget styles                                               */
/* ------------------------------------------------------------------ */
/* Everything is prefixed with `.a11y-widget-root`. The root does       */
/* `all: initial` to block inherited styles from the host, then we      */
/* restyle from scratch. Internal sizing is in px so the host's         */
/* font-scale control can't distort the panel. RTL/LTR mirroring uses   */
/* CSS logical properties only — no hardcoded left/right.               */
/* ================================================================== */

const WIDGET_CSS = `
.a11y-widget-root {
  all: initial;
  position: fixed;
  z-index: 2147483600;
  display: flex;
  gap: 12px;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
    Arial, "Noto Sans Hebrew", "Arial Hebrew", sans-serif;
  font-size: 16px;
  line-height: 1.4;
  color: #14181f;
  pointer-events: none;
}
.a11y-widget-root[dir="rtl"] { direction: rtl; }
.a11y-widget-root[dir="ltr"] { direction: ltr; }
.a11y-widget-root *,
.a11y-widget-root *::before,
.a11y-widget-root *::after { box-sizing: border-box; }
.a11y-widget-root > * { pointer-events: auto; }

/* Corner placement (logical insets so it mirrors with dir). */
.a11y-widget-root[data-position="bottom-start"] {
  inset-block-end: 16px; inset-inline-start: 16px;
  flex-direction: column; align-items: flex-start;
}
.a11y-widget-root[data-position="bottom-end"] {
  inset-block-end: 16px; inset-inline-end: 16px;
  flex-direction: column; align-items: flex-end;
}
.a11y-widget-root[data-position="top-start"] {
  inset-block-start: 16px; inset-inline-start: 16px;
  flex-direction: column-reverse; align-items: flex-start;
}
.a11y-widget-root[data-position="top-end"] {
  inset-block-start: 16px; inset-inline-end: 16px;
  flex-direction: column-reverse; align-items: flex-end;
}

/* Shared focus ring — high contrast, visible on any background. */
.a11y-widget-root :focus-visible {
  outline: 3px solid #0b57d0;
  outline-offset: 2px;
}

/* Floating trigger button */
.a11y-trigger {
  appearance: none;
  -webkit-appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 56px;
  block-size: 56px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #0b57d0;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
  font: inherit;
}
.a11y-trigger:hover { background: #0a4cb8; }
.a11y-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px #ffffff, 0 0 0 6px #0b57d0, 0 4px 14px rgba(0,0,0,.28);
}
.a11y-trigger .a11y-icon { display: block; }

/* Panel */
.a11y-panel {
  inline-size: min(330px, calc(100vw - 32px));
  max-block-size: min(560px, calc(100vh - 96px));
  overflow-y: auto;
  background: #ffffff;
  color: #14181f;
  border: 1px solid #c5ccd6;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  padding: 16px;
}
@media (prefers-reduced-motion: no-preference) {
  .a11y-panel { animation: a11y-pop 140ms ease-out; }
}
@keyframes a11y-pop {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.a11y-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-block-end: 12px;
}
.a11y-titles { flex: 1 1 auto; min-inline-size: 0; }
.a11y-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
  color: #14181f;
}
.a11y-subtitle {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.35;
  color: #4a5260;
}
.a11y-close {
  appearance: none;
  -webkit-appearance: none;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 36px;
  block-size: 36px;
  padding: 0;
  border: 1px solid #c5ccd6;
  border-radius: 8px;
  background: #f3f5f8;
  color: #14181f;
  cursor: pointer;
}
.a11y-close:hover { background: #e6eaf0; }

.a11y-body { display: flex; flex-direction: column; gap: 14px; }
.a11y-group { display: flex; flex-direction: column; gap: 8px; }
.a11y-group-label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #4a5260;
  text-align: start;
}

/* Font-size stepper */
.a11y-font-row { display: flex; gap: 8px; }
.a11y-step {
  appearance: none;
  -webkit-appearance: none;
  flex: 1 1 0;
  block-size: 44px;
  border: 1px solid #b6bdc9;
  border-radius: 10px;
  background: #ffffff;
  color: #14181f;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}
.a11y-step-reset { font-size: 20px; }
.a11y-step:hover:not(:disabled) { background: #eef1f6; border-color: #0b57d0; }
.a11y-step:disabled { opacity: 0.45; cursor: default; }
.a11y-font-status {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #14181f;
  text-align: start;
}

/* Toggle rows */
.a11y-toggle {
  appearance: none;
  -webkit-appearance: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  inline-size: 100%;
  min-block-size: 48px;
  padding-block: 8px;
  padding-inline: 14px;
  border: 1px solid #b6bdc9;
  border-radius: 10px;
  background: #ffffff;
  color: #14181f;
  font-size: 15px;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
}
.a11y-toggle:hover { background: #eef1f6; }
.a11y-toggle-label { flex: 1 1 auto; }
.a11y-state {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  min-inline-size: 40px;
  justify-content: center;
  padding-block: 3px;
  padding-inline: 10px;
  border-radius: 999px;
  border: 1px solid #b6bdc9;
  background: #eef1f6;
  color: #4a5260;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.a11y-toggle[aria-pressed="true"] {
  background: #0b57d0;
  border-color: #0b57d0;
  color: #ffffff;
}
.a11y-toggle[aria-pressed="true"] .a11y-state {
  background: #ffffff;
  border-color: #ffffff;
  color: #0b57d0;
}

/* Reset all */
.a11y-reset {
  appearance: none;
  -webkit-appearance: none;
  inline-size: 100%;
  min-block-size: 46px;
  border: 1px solid #b6bdc9;
  border-radius: 10px;
  background: #fff5f5;
  color: #a01b1b;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.a11y-reset:hover { background: #ffe7e7; border-color: #a01b1b; }

/* Statement link */
.a11y-statement {
  border-block-start: 1px solid #e2e6ec;
  padding-block-start: 12px;
  text-align: center;
}
.a11y-statement-link {
  appearance: none;
  -webkit-appearance: none;
  display: inline-block;
  background: none;
  border: none;
  padding: 4px 6px;
  color: #0b57d0;
  font-size: 14px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.a11y-statement-link:hover { color: #0a3ea0; }

/* Visually-hidden but screen-reader available */
.a11y-sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;
