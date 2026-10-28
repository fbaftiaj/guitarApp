import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { COURSE } from '@/content/course';
import { localDay } from '@/lib/time/localDay';
import { saveSession } from '@/storage/sessions';
import type { LessonProgress } from '@/storage/types';
import { useActivityStore, whenActivityHydrated } from '@/stores/activityStore';
import { useProgressStore } from '@/stores/progressStore';
import { renderRoute } from '@/test/renderRoute';

function complete(ids: readonly string[]) {
  useProgressStore.setState({
    lessons: Object.fromEntries(
      ids.map((lessonId): [string, LessonProgress] => [
        lessonId,
        { lessonId, stars: 2, bestAccuracy: 0.9, attempts: 1, completedAt: 1, updatedAt: 1 },
      ]),
    ),
  });
}

const DAY = 24 * 60 * 60 * 1000;

describe('Profile', () => {
  beforeEach(async () => {
    await whenActivityHydrated();
    useProgressStore.setState({ lessons: {}, status: 'ready' });
    useActivityStore.setState({ days: {} });
  });

  it('starts a new player at Beginner 1 with empty meters', async () => {
    renderRoute('/profile');
    expect(await screen.findByText('Beginner 1')).toBeInTheDocument();
    expect(screen.getByText('Pass the Stage 1 test to reach Beginner 2.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start your first lesson' })).toBeInTheDocument();
    expect(screen.getByText('0 days')).toBeInTheDocument();
    expect(screen.getByText('0 min')).toBeInTheDocument();
    expect(await screen.findByRole('meter', { name: 'Chords' })).toHaveAttribute(
      'aria-valuetext',
      'Not practised yet',
    );
    expect(screen.getByText(/Scored sessions appear here/)).toBeInTheDocument();
    expect(screen.getByText('Chords you learn appear here')).toBeInTheDocument();
  });

  it('shows the level, streak, minutes, meters and history from real results', async () => {
    const stage1 = COURSE.stages[0];
    complete([...(stage1?.lessons.map((l) => l.id) ?? []), stage1?.test?.id ?? '']);
    const now = Date.now();
    useActivityStore.setState({
      days: { [localDay(now)]: 300, [localDay(now - DAY)]: 120, [localDay(now - 3 * DAY)]: 600 },
    });
    await saveSession({
      exerciseId: 'em-am-changes',
      lessonId: null,
      mode: 'practice',
      startedAt: now - 1000,
      durationMs: 30_000,
      bpm: 80,
      accuracy: 0.9,
      hits: { perfect: 14, good: 2, early: 0, late: 0, miss: 0 },
      skills: { chords: 0.9, rhythm: 0.8 },
      missed: {},
    });
    renderRoute('/profile');

    expect(await screen.findByText('Beginner 2')).toBeInTheDocument();
    expect(screen.getByText('15 lessons')).toBeInTheDocument();
    expect(screen.getByText('1 stage')).toBeInTheDocument();
    expect(screen.getByText('2 days')).toBeInTheDocument();
    expect(screen.getByText('17 min')).toBeInTheDocument();
    expect(await screen.findByRole('meter', { name: 'Chords' })).toHaveAttribute(
      'aria-valuenow',
      '90',
    );
    expect(screen.getByRole('meter', { name: 'Rhythm and timing' })).toHaveAttribute(
      'aria-valuetext',
      '80%, from 1 session',
    );
    const chart = screen.getByRole('group', { name: /Accuracy per day/ });
    expect(within(chart).getByRole('img', { name: /90%, 1 session/ })).toBeInTheDocument();
    expect(screen.getByText('1 chord learned')).toBeInTheDocument();
  });
});

describe('Chord library', () => {
  beforeEach(() => {
    useProgressStore.setState({ lessons: {}, status: 'ready' });
  });

  it('is empty until a chord lesson is completed', async () => {
    renderRoute('/profile/chords');
    expect(await screen.findByText('No chords yet')).toBeInTheDocument();
  });

  it('lists learned chords and opens a chord to check it', async () => {
    const user = userEvent.setup();
    complete(['e-minor-chord', 'a-minor-chord']);
    renderRoute('/profile/chords');

    expect(await screen.findByText(/2 of 19 chords learned/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /A minor/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'A minor' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^A minor chord:/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Check it with the microphone' }),
    ).toBeInTheDocument();
  });
});
