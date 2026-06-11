import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, history] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { email: true, createdAt: true, plan: true },
    }),
    prisma.userSearchHistory.findMany({
      where: { userId: id },
      orderBy: { viewedAt: 'desc' },
      select: {
        viewedAt: true,
        searchRecord: { select: { word: true, language: true } },
      },
    }),
  ]);

  if (!user) notFound();

  return (
    <div>
      <Link
        href="/admin/users"
        className="inline-block text-xs text-ink-muted hover:text-ink transition-colors mb-6"
      >
        ← Users
      </Link>

      {/* User info card */}
      <div className="bg-surface border border-line rounded-xl p-5 mb-6">
        <div className="flex items-baseline gap-3 mb-4">
          <h1 className="font-dm-serif text-2xl text-ink">{user.email}</h1>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-[4px] border ${
              user.plan === 'PRO'
                ? 'bg-[#EEF0FF] text-accent border-[#D0D3FF]'
                : 'bg-[#F0F0EE] text-ink-muted border-[#EAEAE6]'
            }`}
          >
            {user.plan}
          </span>
        </div>
        <div className="flex gap-6 text-sm text-ink-muted">
          <span>
            Registered{' '}
            {user.createdAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span>{history.length} word{history.length !== 1 ? 's' : ''} analyzed</span>
        </div>
      </div>

      {/* History table */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
        Search history
      </h2>

      {history.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center">
          <p className="text-sm text-ink-muted">No searches yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm min-w-[360px] bg-surface">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Word
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Language
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, i) => (
                <tr key={i} className={i > 0 ? 'border-t border-line' : ''}>
                  <td className="px-4 py-3 font-medium text-ink">{entry.searchRecord.word}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-[4px] bg-[#F0F0EE] text-ink-muted border border-[#EAEAE6]">
                      {entry.searchRecord.language}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted tabular-nums whitespace-nowrap">
                    {entry.viewedAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
