import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "recap",
  // Kept identical to the hero tagline on the home page - this is what shows
  // in a link preview when someone shares the join URL, which is often the
  // first thing a guest ever reads about the app.
  description: "Everyone adds a frame. Everyone gets the roll.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ink text-bone">{children}</body>
    </html>
  );
}
