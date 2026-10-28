// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analyzeCalibration, scoringLatency } from './latency';

const clicks = Array.from({ length: 8 }, (_, i) => 10 + i * (60 / 90));

describe('scoringLatency', () => {
  it('uses the calibrated value when there is one', () => {
    expect(scoringLatency(85, { outputLatency: 0.3 })).toBeCloseTo(0.085, 12);
    expect(scoringLatency(0, {})).toBe(0);
  });

  it('estimates from the output latency otherwise', () => {
    expect(scoringLatency(null, { outputLatency: 0.02, baseLatency: 0.005 })).toBeCloseTo(
      0.037,
      12,
    );
    expect(scoringLatency(null, {})).toBeCloseTo(0.012, 12);
    expect(scoringLatency(null, { outputLatency: Number.NaN })).toBeCloseTo(0.012, 12);
  });
});

describe('analyzeCalibration', () => {
  it('measures the typical offset of the onsets after the clicks', () => {
    const jitter = [3, -4, 6, -2, 0, 5, -6, 1];
    const onsets = clicks.map((click, i) => click + 0.07 + (jitter[i] ?? 0) / 1000);
    expect(analyzeCalibration(clicks, onsets)).toEqual({
      ok: true,
      latencyMs: 70,
      spreadMs: 4,
      matched: 8,
    });
  });

  it('ignores stray noises and a missed beat', () => {
    const onsets = clicks.flatMap((click, i) => (i === 3 ? [] : [click + 0.05]));
    onsets.push((clicks[5] ?? 0) + 0.3, (clicks[1] ?? 0) - 0.35);
    const result = analyzeCalibration(clicks, onsets);
    expect(result).toMatchObject({ ok: true, latencyMs: 50 });
  });

  it('handles Bluetooth-sized latency', () => {
    const onsets = clicks.map((click) => click + 0.24);
    expect(analyzeCalibration(clicks, onsets)).toMatchObject({ ok: true, latencyMs: 240 });
  });

  it('allows playing slightly ahead of the clicks', () => {
    const onsets = clicks.map((click) => click - 0.02);
    expect(analyzeCalibration(clicks, onsets)).toMatchObject({ ok: true, latencyMs: 0 });
  });

  it('asks for another go when too few beats were heard', () => {
    expect(
      analyzeCalibration(
        clicks,
        clicks.slice(0, 3).map((c) => c + 0.05),
      ),
    ).toEqual({
      ok: false,
      reason: 'too-few',
      matched: 3,
    });
  });

  it('asks for another go when the playing was uneven', () => {
    const offsets = [0.02, 0.09, 0.03, 0.1, 0.01, 0.08, 0.04, 0.11];
    const onsets = clicks.map((click, i) => click + (offsets[i] ?? 0));
    expect(analyzeCalibration(clicks, onsets)).toMatchObject({ ok: false, reason: 'uneven' });
  });
});
