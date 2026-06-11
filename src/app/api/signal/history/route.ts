import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Auth not configured.' }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const rows = await prisma.userSearchHistory.findMany({
      where: { userId: user.id },
      orderBy: { viewedAt: 'desc' },
      take: 20,
      include: {
        searchRecord: {
          select: { word: true, language: true, shareId: true, createdAt: true },
        },
      },
    });

    const history = rows.map((r) => ({
      word:      r.searchRecord.word,
      language:  r.searchRecord.language.toLowerCase(),
      shareId:   r.searchRecord.shareId,
      viewedAt:  r.viewedAt.toISOString(),
    }));

    return NextResponse.json({ history });
  } catch (err) {
    console.error('[GET /api/signal/history] DB error:', err);
    return NextResponse.json({ error: 'Failed to load history.' }, { status: 500 });
  }
}
