import { requireAdmin } from '@/lib/admin';

export default async function AdminPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="font-dm-serif text-2xl text-ink mb-2">Dashboard</h1>
      <p className="text-sm text-ink-muted">Select a section from the sidebar.</p>
    </div>
  );
}
