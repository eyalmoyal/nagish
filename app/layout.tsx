import type { Metadata } from "next";
import "./globals.css";
// The host-page stylesheet that makes the widget's toggled classes/vars do
// something. Import it ONCE, globally, in the host site's root layout.
import "@/components/AccessibilityWidget/a11y-widget-host.css";

export const metadata: Metadata = {
  title: "Accessibility Widget — demo",
  description:
    "Demo host page for the RTL-first accessibility preference widget.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Default to Hebrew / RTL. The demo page flips these at runtime when you
  // switch language, to exercise both directions.
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
