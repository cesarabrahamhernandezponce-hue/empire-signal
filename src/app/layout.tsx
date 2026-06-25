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
    card: 'summary_large_image',
    title: 'Empire Signal',
    description: 'Deep linguistic analysis powered by AI.',
  },
};

// Apply the saved theme AND UI language before first paint. The theme prevents a
// dark-mode flash; setting <html lang> to match the user's chosen language (the
// app writes 'language' = 'en' | 'es') means screen readers announce the content
// with the correct phonetics instead of always reading Spanish as English.
const themeBootstrap = `(function(){try{var d=document.documentElement;if(localStorage.getItem('theme')==='dark'){d.setAttribute('data-theme','dark');}var l=localStorage.getItem('language');if(l==='es'||l==='en'){d.lang=l;}}catch(e){}})();`;

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
