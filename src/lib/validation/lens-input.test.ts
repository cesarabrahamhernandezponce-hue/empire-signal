import { describe, it, expect } from 'vitest';

import { classifyProse, lensRejectionMessage } from './lens-input';

describe('classifyProse — must PASS (real prose, including broken learner writing)', () => {
  it('clean English prose', () => {
    const text =
      'The team shipped the new feature on Friday after a long week of careful testing and review.';
    expect(classifyProse(text, 'EN')).toEqual({ ok: true });
  });

  it('heavily broken learner English with Spanish interference MUST pass', () => {
    // Calques, wrong prepositions, a Spanish word left in — exactly the core
    // user. This must never be rejected as "not language".
    const text =
      'I have 20 years and I go to the school for learn english because is very importante for my work and my family.';
    expect(classifyProse(text, 'EN')).toEqual({ ok: true });
  });

  it('broken Spanish prose passes', () => {
    const text =
      'ola ke tal yo kiero mejorar mi escritura pero a veces no se komo aser las frases mas claras.';
    expect(classifyProse(text, 'ES')).toEqual({ ok: true });
  });

  it('real words mixed with a little gibberish still passes (no over-rejection)', () => {
    const text = 'I really love programming asdfgh but sometimes the code just breaks on me.';
    expect(classifyProse(text, 'EN')).toEqual({ ok: true });
  });

  it('shouting real prose in ALL CAPS still passes (caps alone is not gibberish)', () => {
    const text = 'I AM VERY ANGRY WITH YOU AND I WANT AN ANSWER RIGHT NOW PLEASE.';
    expect(classifyProse(text, 'EN')).toEqual({ ok: true });
  });
});

describe('classifyProse — must FAIL (not language)', () => {
  it('random ALL-CAPS letter strings (the reported bug)', () => {
    const r = classifyProse('UOQBDOUQWBD BJQIWDBOQW UOBDBDOQW', 'EN');
    expect(r).toMatchObject({ ok: false, reason: 'NOT_LANGUAGE' });
  });

  it('lowercase keyboard mashing', () => {
    const r = classifyProse('asdfgh qwerty zxcvbn hjklmn bnmqwe rtyuio', 'EN');
    expect(r).toMatchObject({ ok: false });
  });

  it('a single word repeated', () => {
    const r = classifyProse('hello hello hello hello hello hello', 'EN');
    expect(r).toMatchObject({ ok: false, reason: 'REPEATED' });
  });

  it('too short / too few real words', () => {
    const r = classifyProse('hi there', 'EN');
    expect(r).toMatchObject({ ok: false, reason: 'TOO_SHORT' });
  });

  it('empty / punctuation-only is NOT_LANGUAGE', () => {
    expect(classifyProse('!!! ... ??? @#$', 'EN')).toMatchObject({ ok: false, reason: 'NOT_LANGUAGE' });
  });
});

describe('messages', () => {
  it('returns a non-empty message in the requested language', () => {
    const en = lensRejectionMessage('NOT_LANGUAGE', 'EN');
    const es = lensRejectionMessage('NOT_LANGUAGE', 'ES');
    expect(en.length).toBeGreaterThan(0);
    expect(es.length).toBeGreaterThan(0);
    expect(en).not.toEqual(es);
  });
});
