// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CHORDS } from '@/content/chords';
import { voicingTemplate } from '@/lib/music/chordTemplates';
import { midiToFrequency } from '@/lib/music/notes';
import { WaitMatcher } from './waitMatcher';

const chromaOf = (id: string) => voicingTemplate(CHORDS.get(id)?.midis ?? []);

describe('WaitMatcher', () => {
  it('reports wrong attempts and ends the wait on the right chord', () => {
    const onAttempt = vi.fn();
    const matcher = new WaitMatcher({ a4: 440, onAttempt });
    matcher.wait({ kind: 'chord', chordId: 'Am', direction: 'down' }, 5);

    matcher.addOnset({ time: 5.4, strength: 1 });
    matcher.addChroma({ onsetTime: 5.4, chroma: chromaOf('C') });
    expect(onAttempt).toHaveBeenLastCalledWith(false);
    expect(matcher.waiting).toBe(true);

    matcher.addOnset({ time: 6, strength: 1 });
    matcher.addChroma({ onsetTime: 6, chroma: chromaOf('Am') });
    expect(onAttempt).toHaveBeenLastCalledWith(true);
    expect(matcher.waiting).toBe(false);
  });

  it('counts a strum just before the wait began, not one long before', () => {
    const onAttempt = vi.fn();
    const matcher = new WaitMatcher({ a4: 440, onAttempt });
    matcher.wait({ kind: 'chord', chordId: 'Em', direction: 'down' }, 5);
    matcher.addOnset({ time: 4.5, strength: 1 });
    matcher.addChroma({ onsetTime: 4.5, chroma: chromaOf('Em') });
    expect(onAttempt).not.toHaveBeenCalled();
    matcher.addOnset({ time: 4.9, strength: 1 });
    matcher.addChroma({ onsetTime: 4.9, chroma: chromaOf('Em') });
    expect(onAttempt).toHaveBeenCalledWith(true);
  });

  it('listens for notes by pitch and ignores input when not waiting', () => {
    const onAttempt = vi.fn();
    const matcher = new WaitMatcher({ a4: 440, onAttempt });
    matcher.addOnset({ time: 1, strength: 1 });
    matcher.wait({ kind: 'note', midi: 45 }, 2);
    matcher.addOnset({ time: 2.1, strength: 1 });
    for (let i = 0; i < 3; i++) {
      matcher.addPitch({
        time: 2.2 + i * 0.01,
        frequency: midiToFrequency(45),
        clarity: 0.95,
        rms: 0.05,
      });
    }
    expect(onAttempt).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('gives up on an attempt whose pitch never settles', () => {
    const onAttempt = vi.fn();
    const matcher = new WaitMatcher({ a4: 440, onAttempt });
    matcher.wait({ kind: 'note', midi: 45 }, 2);
    matcher.addOnset({ time: 2.1, strength: 1 });
    matcher.update(2.3);
    expect(onAttempt).not.toHaveBeenCalled();
    matcher.update(2.45);
    expect(onAttempt).toHaveBeenCalledWith(false);
  });
});
