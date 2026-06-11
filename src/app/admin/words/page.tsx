import { prisma } from '@/lib/db/prisma';
import type { Language } from '@prisma/client';

type WordRow = { word: string; language: Language; _count: { id: number } };

function WordTable({ title, rows, sortDir }: { title: string; rows: WordRow[]; sortDir: 'asc' | 'desc' }) {
  const nextSort = sortDir === 'desc' ? 'asc' : 'desc';
  const arrow = sortDir === 'desc' ? '↓' : '↑';

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">{title}</h2>
      {rows.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-ink-muted">No searches yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm min-w-[240px] bg-surface">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Word
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  <a href={`?sort=${nextSort}`} className="hover:text-ink transition-colors">
                    Searches {arrow}
                  </a>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.word} className={i > 0 ? 'border-t border-line' : ''}>
                  <td className="px-4 py-3 font-medium text-ink">{row.word}</td>
                  <td className="px-4 py-3 text-ink-muted tabular-nums">{row._count.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function WordsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { sort } = await searchParams;
  const sortDir: 'asc' | 'desc' = sort === 'asc' ? 'asc' : 'desc';

  const rows = await prisma.searchEvent.groupBy({
    by: ['word', 'language'],
    _count: { id: true },
    orderBy: { _count: { id: sortDir } },
  });

  const enRows = rows.filter((r) => r.language === 'EN');
  const esRows = rows.filter((r) => r.language === 'ES');
  const total = rows.length;

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="font-dm-serif text-2xl text-ink">Words</h1>
        <span className="text-sm text-ink-muted">{total} unique words</span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <WordTable title={`English (EN) · ${enRows.length}`} rows={enRows} sortDir={sortDir} />
        <WordTable title={`Spanish (ES) · ${esRows.length}`} rows={esRows} sortDir={sortDir} />
      </div>
    </div>
  );
}
