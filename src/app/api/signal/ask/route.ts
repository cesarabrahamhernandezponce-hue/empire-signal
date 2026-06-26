import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Language as DbLanguage } from '@prisma/client';

import { askFollowUp } from '@/lib/services/signal';
import { prisma } from '@/lib/db/prisma';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import type { Language } from '@/lib/ai/prompts/types';
import { getClientIp, hashIp, checkDbLimit } from '@/lib/rate-limit';
import { isOwnerRequest, readJsonBody } from '@/lib/api-guard';

const DAILY_LIMIT = 20;

const bodySchema = z.object({
  searchRecordId: z.string().min(1),
  question:       z.string().min(1).max(500).trim(),
});

const LANGUAGE_MAP: Record<DbLanguage, Language> = {
  ES: 'es',
  EN: 'en',
};

export async function POST(request: Request) {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }

    const parsed = bodySchema.safeParse(bodyResult.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid parameters: ${first.path.join('.') || 'body'} — ${first.message}` },
        { status: 400 },
      );
    }

    const { searchRecordId, question } = parsed.data;

    const isOwner = isOwnerRequest(request);

    let userId: string | null = null;
    if (!isOwner) {
      const supabase = await createSupabaseClient();
      const user = supabase ? (await supabase.auth.getUser()).data.user : null;
      if (!user) {
        return NextResponse.json({ error: 'Sign in to ask follow-up questions.' }, { status: 401 });
      }
      userId = user.id;

      const ipHash = hashIp(getClientIp(request));
      if (!(await checkDbLimit('ask', ipHash, DAILY_LIMIT))) {
        return NextResponse.json({ error: 'Daily limit reached. Come back tomorrow.' }, { status: 429 });
      }
    }

    const record = await prisma.searchRecord.findUnique({ where: { id: searchRecordId } });
    if (!record) {
      return NextResponse.json({ error: 'Analysis not found.' }, { status: 404 });
    }

    const result = await askFollowUp({
      word:           record.word,
      context:        record.context,
      question,
      language:       LANGUAGE_MAP[record.language],
      searchRecordId,
      userId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    return NextResponse.json({ answer: result.answer }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/signal/ask] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
