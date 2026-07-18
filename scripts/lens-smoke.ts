#!/usr/bin/env node
// Empire Lens — Step 1 quality harness.
//
// Calls analyzeWithLens directly (no DB, no HTTP) against sample texts of
// different quality and prints the raw diagnostic JSON so we can judge whether
// the INSIGHT is genuinely good before building any UI.
//
// Run:
//   node --env-file=.env.local scripts/lens-smoke.ts

// Imports use .ts extensions because this runs under raw Node (no bundler).
// We replicate analyzeWithLens inline rather than import the service, whose
// internal imports are extensionless (resolved by the Next bundler, not Node).
import { generateContent } from '../src/lib/ai/client.ts';
import { buildLensPromptEN } from '../src/lib/ai/prompts/lens-en.ts';
import { buildLensPromptES } from '../src/lib/ai/prompts/lens-es.ts';
import { parseLens, type LensProfile } from '../src/lib/ai/schemas/lens.ts';
import type { Language } from '../src/lib/ai/prompts/types.ts';

type LensResult =
  | { ok: true; profile: LensProfile; model: string | null }
  | { ok: false; error: string };

async function analyzeWithLens(params: { text: string; language: Language }): Promise<LensResult> {
  const { text, language } = params;
  const prompt = language === 'es' ? buildLensPromptES(text) : buildLensPromptEN(text);
  const aiResult = await generateContent(prompt);
  if (!aiResult.ok) return { ok: false, error: aiResult.error };
  const first = parseLens(aiResult.text);
  if (first.ok && !first.analyzable) return { ok: false, error: `not analyzable: ${first.reason}` };
  if (first.ok) return { ok: true, profile: first.profile, model: `${aiResult.provider}:${aiResult.model}` };
  const retry = await generateContent(prompt);
  if (!retry.ok) return { ok: false, error: 'Could not generate a valid writing profile.' };
  const second = parseLens(retry.text);
  if (second.ok && !second.analyzable) return { ok: false, error: `not analyzable: ${second.reason}` };
  if (!second.ok) return { ok: false, error: 'Could not generate a valid writing profile.' };
  return { ok: true, profile: second.profile, model: `${retry.provider}:${retry.model}` };
}

type Sample = { name: string; lang: Language; text: string };

const SAMPLES: Sample[] = [
  {
    name: 'A — weak EN (Spanish speaker: repetition, crutches, calques)',
    lang: 'en',
    text:
      'I think this book is very good. The story is very interesting and the characters are very good too. ' +
      'Actually, I am reading it since two months because I have a lot of work. The author make a very good ' +
      'description of the city and the people there is very different. In my opinion is a good book and I ' +
      'recommend it to all the persons that like good stories.',
  },
  {
    name: 'B — strong EN (polished, varied — should be honest about strength)',
    lang: 'en',
    text:
      'The negotiations collapsed not because the terms were unreasonable, but because neither delegation ' +
      'trusted the other to honor them. By the third afternoon, the room had hardened into two camps, each ' +
      'rehearsing grievances older than the treaty itself. What remained was procedure: a signature nobody ' +
      'believed in, drying on a page nobody would read.',
  },
  {
    name: 'C — mixed register EN (formal + slang clash)',
    lang: 'en',
    text:
      'The quarterly report indicates a substantial decline in revenue. Honestly though, the numbers are ' +
      'kinda bad and the whole thing is a mess. We hereby request that stakeholders review the attached ' +
      'financials ASAP, no cap.',
  },
  {
    name: 'D — weak ES (anglicisms + crutches)',
    lang: 'es',
    text:
      'Quiero aplicar para un trabajo nuevo porque mi trabajo actual no me hace sentido. La verdad es que ' +
      'es una cosa muy difícil y muy importante para mí. Pienso que voy a tomar la decisión pronto porque ' +
      'tengo que remover muchas cosas de mi vida.',
  },
];

function divider(char = '─') { return char.repeat(78); }

async function main() {
  for (const s of SAMPLES) {
    console.log('\n' + divider('═'));
    console.log(s.name);
    console.log(divider('═'));
    console.log(`TEXT (${s.text.trim().split(/\s+/).length} words): ${s.text}\n`);

    const t0 = Date.now();
    const result = await analyzeWithLens({ text: s.text, language: s.lang });
    const ms = Date.now() - t0;

    if (!result.ok) {
      console.log(`✗ FAILED in ${ms}ms: ${result.error}`);
      continue;
    }
    console.log(`✓ OK in ${ms}ms  [model: ${result.model}]\n`);
    console.log(JSON.stringify(result.profile, null, 2));
  }
  console.log('\n' + divider('═'));
  console.log('LENS SMOKE DONE');
  console.log(divider('═') + '\n');
}

main().catch((err) => {
  console.error('[lens-smoke] FATAL', err);
  process.exit(1);
});
