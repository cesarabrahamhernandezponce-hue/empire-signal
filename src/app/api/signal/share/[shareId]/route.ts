import { NextResponse } from 'next/server';

import { getAnalysisByShareId } from '@/lib/services/signal';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string }> },
) {
  try {
    const { shareId } = await params;

    if (!shareId?.trim()) {
      return NextResponse.json({ error: 'shareId is required.' }, { status: 400 });
    }

    const result = await getAnalysisByShareId(shareId);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.notFound ? 404 : 500 });
    }

    return NextResponse.json({ record: result.record }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/signal/share/[shareId]] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
