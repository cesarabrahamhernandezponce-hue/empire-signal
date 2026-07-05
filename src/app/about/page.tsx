import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { absolute: 'About — Empire Signal' },
  description:
    'Why Empire Signal exists: a tool that tells you how a word behaves — register, collocations, common learner errors — not just what it means.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-8 sm:py-10">
        <Link
          href="/"
          className="text-xs text-ink-muted hover:text-accent transition-colors"
        >
          ← Back to Empire Signal
        </Link>

        <header className="mt-8 mb-8">
          <h1
            className="text-3xl sm:text-4xl text-ink"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            About
          </h1>
        </header>

        <div className="space-y-6 text-[15px] leading-relaxed text-ink-muted">
          <p>
            I&apos;m César, a computer science student in Havana, Cuba. I built
            Empire Signal because I kept hitting the same wall learning English: I
            knew thousands of words, but I couldn&apos;t tell which ones sounded
            natural, which were too formal, and which were simply off in a real
            context.
          </p>

          <p>
            Traditional dictionaries tell you what a word means. Empire Signal
            tells you how a word behaves — its register, the words it likes to keep
            company with, the mistakes learners make with it, where it comes from,
            and its CEFR level.
          </p>

          <p>
            It&apos;s built solo, on a zero-dollar budget, with intermittent
            internet. Every architectural decision reflects that constraint — from
            the shared cache that avoids paying for the same analysis twice, to the
            way the app degrades gracefully when the connection drops.
          </p>

          <p>
            If it helps you, or if something feels wrong, I&apos;d love to hear
            from you. Write to{' '}
            <a
              href="mailto:cesarabrahamhernandezponce@gmail.com"
              className="text-accent hover:text-accent-hover transition-colors"
            >
              cesarabrahamhernandezponce@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
