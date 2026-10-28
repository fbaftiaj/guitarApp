import { useMemo, useState } from 'react';
import type { AnalysisFeatures } from '@/audio/worklets/analysisProtocol';
import { useMicrophone, type Microphone } from '../practice/listening/useMicrophone';
import { judgeStrum, type StrumJudgement } from '../practice/scoring/chordRecognition';

export interface ChordCheck extends Microphone {
  /** The latest strum's judgement, numbered so a repeat of the same result still shows. */
  result: (StrumJudgement & { attempt: number }) | null;
}

/** Listens for strums of one chord and judges each with the practicer's chord recognition. */
export function useChordCheck(chordId: string, a4: number): ChordCheck {
  const [result, setResult] = useState<ChordCheck['result']>(null);
  const features = useMemo<AnalysisFeatures>(
    () => ({ pitch: null, onsets: true, chroma: true, a4 }),
    [a4],
  );
  const microphone = useMicrophone(features, {
    onChroma: (event) => {
      setResult((previous) => ({
        ...judgeStrum(event.chroma, chordId),
        attempt: (previous?.attempt ?? 0) + 1,
      }));
    },
  });
  const { start } = microphone;
  return {
    ...microphone,
    result,
    start: () => {
      setResult(null);
      start();
    },
  };
}
