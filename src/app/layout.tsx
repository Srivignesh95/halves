import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Halves", template: "%s · Halves" },
  description: "Split bills with friends and groups, see who owes what, settle up.",
  applicationName: "Halves",
  // iPhone: "Add to Home Screen" opens full screen with this name and icon
  appleWebApp: { capable: true, title: "Halves", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon-32.png", sizes: "32x32" }, { url: "/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5032c8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* browser extensions (Grammarly, ColorZilla...) add attributes to <body> before React loads */}
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
