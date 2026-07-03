import type { Metadata } from 'next';

import LensClient from './LensClient';

const lensTitle = 'Empire Lens — Not a rewrite. A mirror.';
const lensDescription =
  "Paste something you wrote. Empire Lens shows you your register consistency, lexical variety, and the patterns you don't see in your own writing.";

export const metadata: Metadata = {
  title: { absolute: lensTitle },
  description: lensDescription,
  openGraph: {
    title: lensTitle,
    description: lensDescription,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: lensTitle,
    description: lensDescription,
    images: ['/opengraph-image'],
  },
};

export default function LensPage() {
  return <LensClient />;
}
