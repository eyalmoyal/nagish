/**
 * i18n strings for the Accessibility Widget.
 *
 * All user-facing copy lives here. To add a language, add a key to `Lang` and a
 * matching entry to `STRINGS` with the same shape as `he` / `en`.
 *
 * Note on wording: this is a USER-PREFERENCE tool. Copy intentionally avoids any
 * claim that the widget makes a site "accessible", "compliant", or meets any
 * standard/law. Keep it that way.
 */

export type Lang = "he" | "en";

export interface WidgetStrings {
  /** Direction for this language; drives `dir` on the widget root. */
  dir: "rtl" | "ltr";
  /** aria-label for the floating trigger button. */
  triggerLabel: string;
  /** Visible (and accessible) name of the dialog. */
  title: string;
  /** Short, non-compliance-claiming subtitle shown under the title. */
  subtitle: string;
  /** aria-label for the close button. */
  close: string;

  /** Font-size group. */
  fontSize: string;
  fontIncrease: string;
  fontDecrease: string;
  fontReset: string;
  /** Template for the current scale, e.g. "Text size: {value}%". */
  fontCurrent: (percent: number) => string;

  /** Toggle controls. */
  highContrast: string;
  readableFont: string;
  highlightLinks: string;
  stopAnimations: string;

  /** Reset-all action. */
  resetAll: string;

  /** Accessibility statement link. */
  statement: string;

  /** Spoken/assistive on-off state words (used in aria-label suffixes). */
  on: string;
  off: string;

  /** Announced when reset-all runs (aria-live). */
  resetAnnouncement: string;
}

export const STRINGS: Record<Lang, WidgetStrings> = {
  he: {
    dir: "rtl",
    triggerLabel: "פתיחת תפריט התאמות נגישות",
    title: "התאמות תצוגה",
    subtitle: "התאמות אישיות לתצוגה בדפדפן שלך",
    close: "סגירת התפריט",

    fontSize: "גודל טקסט",
    fontIncrease: "הגדלת טקסט",
    fontDecrease: "הקטנת טקסט",
    fontReset: "איפוס גודל טקסט",
    fontCurrent: (p) => `גודל טקסט: ${p}%`,

    highContrast: "ניגודיות גבוהה",
    readableFont: "גופן קריא",
    highlightLinks: "הדגשת קישורים",
    stopAnimations: "עצירת אנימציות",

    resetAll: "איפוס כל ההתאמות",

    statement: "הצהרת נגישות",

    on: "פעיל",
    off: "כבוי",

    resetAnnouncement: "כל ההתאמות אופסו",
  },
  en: {
    dir: "ltr",
    triggerLabel: "Open accessibility preferences",
    title: "Display preferences",
    subtitle: "Personal display settings for your browser",
    close: "Close menu",

    fontSize: "Text size",
    fontIncrease: "Increase text size",
    fontDecrease: "Decrease text size",
    fontReset: "Reset text size",
    fontCurrent: (p) => `Text size: ${p}%`,

    highContrast: "High contrast",
    readableFont: "Readable font",
    highlightLinks: "Highlight links",
    stopAnimations: "Stop animations",

    resetAll: "Reset all preferences",

    statement: "Accessibility statement",

    on: "on",
    off: "off",

    resetAnnouncement: "All preferences have been reset",
  },
};
