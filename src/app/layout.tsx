import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
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

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});


const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://empire-signal.vercel.app';

const siteTitle = 'Empire Signal — You know the word. But do you know how to use it?';
const siteDescription =
  'Deep word analysis for intermediate and advanced English learners: register, collocations, real usage, common errors. Beyond the dictionary.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: '%s — Empire Signal',
  },
  description: siteDescription,
  applicationName: 'Empire Signal',
  openGraph: {
    type: 'website',
    siteName: 'Empire Signal',
    locale: 'en_US',
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
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
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable}`}
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
