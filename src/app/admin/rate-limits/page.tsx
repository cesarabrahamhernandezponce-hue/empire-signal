import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/admin';

const DAILY_LIMIT = 10;
const DAYS = 14;

type RateLimitRow = {
  ipHash: string | null;
  userId: string | null;
  email: string | null;
  date: Date | string;
  count: number;
};

export default async function RateLimitsPage() {
  await requireAdmin();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS);
  cutoff.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    SELECT
      se."ipHash",
      MAX(se."userId")  AS "userId",
      MAX(u.email)      AS email,
      DATE(se."createdAt") AS date,
      COUNT(*)::int        AS count
    FROM search_events se
    LEFT JOIN users u ON u.id = se."userId"
    WHERE se."cacheHit" = false
      AND se."createdAt" >= ${cutoff}
    GROUP BY se."ipHash", DATE(se."createdAt")
    ORDER BY count DESC
  `;

  function formatDate(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function identifier(row: RateLimitRow): string {
    if (row.email) return row.email;
    if (row.ipHash) return `${row.ipHash.slice(0, 10)}…`;
    return 'unknown';
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="font-dm-serif text-2xl text-ink">Rate limits</h1>
        <span className="text-sm text-ink-muted">last {DAYS} days · non-cached only</span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center">
          <p className="text-sm text-ink-muted">No searches in the last {DAYS} days.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm min-w-[520px] bg-surface">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  User / IP
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Searches
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const hitLimit = row.count >= DAILY_LIMIT;
                return (
                  <tr key={i} className={i > 0 ? 'border-t border-line' : ''}>
                    <td className="px-4 py-3 text-ink font-medium">
                      {identifier(row)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted tabular-nums whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={hitLimit ? 'text-ink font-semibold' : 'text-ink-muted'}>
                        {row.count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hitLimit && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-[4px] bg-[#EEF0FF] text-accent border border-[#D0D3FF]">
                          limit hit
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
