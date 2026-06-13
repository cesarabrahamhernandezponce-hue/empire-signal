import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PostHogProvider from "./PostHogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://empire-signal.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Empire Signal',
    template: '%s · Empire Signal',
  },
  description: 'Deep linguistic analysis powered by AI.',
  applicationName: 'Empire Signal',
  openGraph: {
    type: 'website',
    siteName: 'Empire Signal',
    title: 'Empire Signal',
    description: 'Deep linguistic analysis powered by AI.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary',
    title: 'Empire Signal',
    description: 'Deep linguistic analysis powered by AI.',
  },
};

// Apply the saved theme before first paint so dark mode doesn't flash light
// (and so non-home pages, which never ran the home page's theme effect, still
// honor the user's choice). Reads the same 'theme' key the app writes.
const themeBootstrap = `(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
