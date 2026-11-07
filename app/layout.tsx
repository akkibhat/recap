import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "recap",
  // Kept identical to the home page's headline idea - this is what shows in a
  // link preview when someone shares the join URL, which is often the first
  // thing a guest ever reads about the app.
  description: "Everyone adds a photo to the roll. A shared photo board for one night.",
};

// The page shell for every route: loads General Sans and sets the black ground.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* General Sans comes from Fontshare (not on Google Fonts, so next/font
            can't load it). Preconnect first so the headline doesn't wait. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-ink text-bone">{children}</body>
    </html>
  );
}
