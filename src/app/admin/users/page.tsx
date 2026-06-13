import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/admin';

export default async function UsersPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      createdAt: true,
      plan: true,
    },
  });

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="font-dm-serif text-2xl text-ink">Users</h1>
        <span className="text-sm text-ink-muted">{users.length} registered</span>
      </div>

      {users.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl px-8 py-12 text-center">
          <p className="text-sm text-ink-muted">No users yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm min-w-[520px] bg-surface">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Registered
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Country
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Plan
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} className={`hover:bg-bg transition-colors ${i > 0 ? 'border-t border-line' : ''}`}>
                  <td className="px-4 py-3 text-ink-muted tabular-nums whitespace-nowrap">
                    {user.createdAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-ink">{user.email}</td>
                  <td className="px-4 py-3 text-ink-muted">—</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-[4px] border ${
                        user.plan === 'PRO'
                          ? 'bg-[#EEF0FF] text-accent border-[#D0D3FF]'
                          : 'bg-[#F0F0EE] text-ink-muted border-[#EAEAE6]'
                      }`}
                    >
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-xs text-ink-muted hover:text-accent transition-colors"
                    >
                      View →
                    </Link>
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
