import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Halves", template: "%s · Halves" },
  description: "Split bills with friends and groups, see who owes what, settle up.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans" suppressHydrationWarning>{children}</body>
    </html>
  );
}
