import { NextResponse } from 'next/server';
import { Language as DbLanguage } from '@prisma/client';

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

export async function DELETE(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Auth not configured.' }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { word?: unknown; language?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  const word = typeof body.word === 'string' ? body.word.trim() : '';
  const langParam = body.language === 'es' ? 'es' : body.language === 'en' ? 'en' : null;
  if (!word || !langParam) {
    return NextResponse.json({ error: 'word and language are required.' }, { status: 400 });
  }
  const dbLanguage = langParam === 'es' ? DbLanguage.ES : DbLanguage.EN;

  try {
    await prisma.userSearchHistory.deleteMany({
      where: {
        userId: user.id,
        searchRecord: { word: { equals: word, mode: 'insensitive' }, language: dbLanguage },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/signal/history] DB error:', err);
    return NextResponse.json({ error: 'Failed to delete history entry.' }, { status: 500 });
  }
}
