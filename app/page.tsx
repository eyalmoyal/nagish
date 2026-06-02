"use client";

import { useEffect, useState } from "react";
import AccessibilityWidget, {
  type WidgetPosition,
} from "@/components/AccessibilityWidget/AccessibilityWidget";
import type { Lang } from "@/components/AccessibilityWidget/i18n";

/**
 * Demo host page.
 *
 * Renders ordinary, NON-retrofitted content — a form, images, links, and a CSS
 * animation — so you can confirm every widget control actually changes the page.
 * It also flips the document's lang/dir when you switch language, so you can see
 * the whole page (and the widget) mirror correctly.
 */

const COPY: Record<Lang, Record<string, string>> = {
  he: {
    flag: "🇮🇱",
    langName: "עברית",
    heading: "ברוכים הבאים לאתר ההדגמה",
    intro:
      "זהו עמוד תוכן רגיל לבדיקת רכיב הנגישות. שנו את ההעדפות בכפתור הצף ובדקו כיצד הטקסט, הצבעים, הקישורים והאנימציה משתנים.",
    sizingNote:
      "הטקסט כאן מוגדר ביחידות rem, כך שכפתור גודל הטקסט משפיע עליו ישירות.",
    linksHeading: "קישורים לדוגמה",
    link1: "מאמר על נגישות ברשת",
    link2: "מדריך לקוראי מסך",
    link3: "קיצורי מקלדת",
    formHeading: "טופס יצירת קשר",
    nameLabel: "שם מלא",
    emailLabel: "דוא״ל",
    topicLabel: "נושא",
    topicGeneral: "כללי",
    topicSupport: "תמיכה",
    topicFeedback: "משוב",
    messageLabel: "הודעה",
    subscribe: "עדכנו אותי במייל",
    submit: "שליחה",
    animHeading: "אנימציה לדוגמה",
    animNote:
      "הריבוע מסתובב והעיגול פועם. הפעלת “עצירת אנימציות” תעצור אותם.",
    imgHeading: "תמונות עם טקסט חלופי",
    posLabel: "מיקום הכפתור",
    langSwitch: "Switch to English",
  },
  en: {
    flag: "🇬🇧",
    langName: "English",
    heading: "Welcome to the demo site",
    intro:
      "This is ordinary page content for testing the accessibility widget. Change preferences from the floating button and watch the text, colours, links and animation respond.",
    sizingNote:
      "Text here is sized in rem, so the text-size control affects it directly.",
    linksHeading: "Sample links",
    link1: "An article about web accessibility",
    link2: "A guide to screen readers",
    link3: "Keyboard shortcuts",
    formHeading: "Contact form",
    nameLabel: "Full name",
    emailLabel: "Email",
    topicLabel: "Topic",
    topicGeneral: "General",
    topicSupport: "Support",
    topicFeedback: "Feedback",
    messageLabel: "Message",
    subscribe: "Email me updates",
    submit: "Send",
    animHeading: "Sample animation",
    animNote:
      'The square rotates and the circle pulses. Turning on "Stop animations" halts them.',
    imgHeading: "Images with alt text",
    posLabel: "Button position",
    langSwitch: "החלפה לעברית",
  },
};

const POSITIONS: WidgetPosition[] = [
  "bottom-start",
  "bottom-end",
  "top-start",
  "top-end",
];

export default function DemoPage() {
  const [lang, setLang] = useState<Lang>("he");
  const [position, setPosition] = useState<WidgetPosition>("bottom-start");
  const c = COPY[lang];

  // Flip the whole document's language/direction with the demo, so host content
  // mirrors too (the widget manages its own dir independently via its prop).
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);

  return (
    <main className="demo">
      <header className="demo-topbar">
        <div className="demo-brand">
          <span aria-hidden="true" className="demo-logo">
            ✶
          </span>
          <span>Nagish&nbsp;Demo</span>
        </div>
        <div className="demo-controls">
          <button
            type="button"
            className="demo-btn"
            onClick={() => setLang(lang === "he" ? "en" : "he")}
          >
            {c.langSwitch}
          </button>
          <label className="demo-select">
            <span>{c.posLabel}</span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as WidgetPosition)}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="demo-container">
        <h1 className="demo-h1">{c.heading}</h1>
        <p className="demo-lead">{c.intro}</p>
        <p className="demo-note">{c.sizingNote}</p>

        <section className="demo-section" aria-labelledby="links-h">
          <h2 id="links-h" className="demo-h2">
            {c.linksHeading}
          </h2>
          <ul className="demo-links">
            <li>
              <a href="#article">{c.link1}</a>
            </li>
            <li>
              <a href="#guide">{c.link2}</a>
            </li>
            <li>
              <a href="#shortcuts">{c.link3}</a>
            </li>
          </ul>
        </section>

        <section className="demo-section" aria-labelledby="img-h">
          <h2 id="img-h" className="demo-h2">
            {c.imgHeading}
          </h2>
          <div className="demo-gallery">
            <img src="/sample-1.svg" alt="Abstract teal and indigo waves" width={240} height={150} />
            <img src="/sample-2.svg" alt="Geometric orange and pink mountains" width={240} height={150} />
          </div>
        </section>

        <section className="demo-section" aria-labelledby="anim-h">
          <h2 id="anim-h" className="demo-h2">
            {c.animHeading}
          </h2>
          <p>{c.animNote}</p>
          <div className="demo-anim" aria-hidden="true">
            <div className="demo-square" />
            <div className="demo-circle" />
          </div>
        </section>

        <section className="demo-section" aria-labelledby="form-h">
          <h2 id="form-h" className="demo-h2">
            {c.formHeading}
          </h2>
          <form className="demo-form" onSubmit={(e) => e.preventDefault()}>
            <div className="demo-field">
              <label htmlFor="name">{c.nameLabel}</label>
              <input id="name" name="name" type="text" autoComplete="name" />
            </div>
            <div className="demo-field">
              <label htmlFor="email">{c.emailLabel}</label>
              <input id="email" name="email" type="email" autoComplete="email" />
            </div>
            <div className="demo-field">
              <label htmlFor="topic">{c.topicLabel}</label>
              <select id="topic" name="topic">
                <option>{c.topicGeneral}</option>
                <option>{c.topicSupport}</option>
                <option>{c.topicFeedback}</option>
              </select>
            </div>
            <div className="demo-field">
              <label htmlFor="message">{c.messageLabel}</label>
              <textarea id="message" name="message" rows={3} />
            </div>
            <div className="demo-check">
              <input id="subscribe" name="subscribe" type="checkbox" />
              <label htmlFor="subscribe">{c.subscribe}</label>
            </div>
            <button type="submit" className="demo-submit">
              {c.submit}
            </button>
          </form>
        </section>
      </div>

      {/* The widget under test. */}
      <AccessibilityWidget
        lang={lang}
        position={position}
        statementUrl="#accessibility-statement"
      />
    </main>
  );
}
