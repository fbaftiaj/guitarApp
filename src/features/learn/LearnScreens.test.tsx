import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { lessonPath, trainerPath } from '@/app/navigation';
import { COURSE } from '@/content/course';
import type { LessonProgress, StarCount } from '@/storage/types';
import { useProgressStore } from '@/stores/progressStore';
import { renderRoute } from '@/test/renderRoute';

const [first, second, third] = COURSE.lessons;

function complete(lessonIds: readonly string[], stars: StarCount = 2) {
  useProgressStore.setState({
    lessons: Object.fromEntries(
      lessonIds.map((lessonId): [string, LessonProgress] => [
        lessonId,
        { lessonId, stars, bestAccuracy: 0.9, attempts: 1, completedAt: 1, updatedAt: 1 },
      ]),
    ),
  });
}

describe('Learn screens', () => {
  beforeEach(() => {
    useProgressStore.setState({ lessons: {}, status: 'ready' });
  });

  it('starts a new course at the first lesson, with later stages closed', async () => {
    const user = userEvent.setup();
    renderRoute('/learn');

    await screen.findByRole('heading', { level: 1, name: 'Learn' });
    const stages = within(screen.getByRole('list', { name: 'Stages' })).getAllByRole('listitem');
    expect(stages).toHaveLength(8);
    expect(stages[1]).toHaveTextContent('Pass the Stage 1 test to unlock');
    expect(stages[3]).toHaveTextContent('Coming soon');

    await user.click(screen.getByRole('link', { name: 'Start the first lesson' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: first?.title ?? '' }),
    ).toBeInTheDocument();
  });

  it('shows the planned lessons of a preview stage', async () => {
    renderRoute('/learn/stage/lead-guitar-1');
    await screen.findByRole('heading', { level: 1, name: 'Stage 6: Lead Guitar I' });
    expect(screen.getByText(/These lessons are coming soon/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Unit 1 · The minor pentatonic scale/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pentatonic box 1')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pentatonic box 1/ })).toBeNull();
  });

  it('offers to continue where the player left off', async () => {
    complete([first?.id ?? '']);
    renderRoute('/learn');

    expect(await screen.findByRole('link', { name: 'Continue' })).toHaveAttribute(
      'href',
      `/learn/lesson/${second?.id ?? ''}/learn`,
    );
    expect(screen.getByText(second?.title ?? '')).toBeInTheDocument();
  });

  it('lists a stage’s units and lessons with their state', async () => {
    complete([first?.id ?? ''], 3);
    renderRoute('/learn/stage/first-steps');

    await screen.findByRole('heading', { level: 1, name: 'Stage 1: First Steps' });
    expect(screen.getByRole('heading', { name: /Unit 1 · Meet your guitar/ })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Parts of the guitar.*completed/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '3 of 3 stars' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Sitting with the guitar.*up next/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Holding the pick/ })).toBeNull();
    expect(screen.getByText('1 of 15 lessons')).toBeInTheDocument();
  });

  it('keeps locked lessons closed and points to the next one', async () => {
    const user = userEvent.setup();
    renderRoute(`/learn/lesson/${third?.id ?? ''}/check`);

    expect(await screen.findByText('This lesson is locked')).toBeInTheDocument();
    expect(screen.getByText(`Pass “${second?.title ?? ''}” to unlock it.`)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: `Go to “${first?.title ?? ''}”` }));
    expect(
      await screen.findByRole('heading', { level: 1, name: first?.title ?? '' }),
    ).toBeInTheDocument();
  });

  it('walks through Learn, Listen, Practice and Check', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute(`/learn/lesson/${first?.id ?? ''}`);

    await screen.findByRole('heading', { level: 1, name: first?.title ?? '' });
    expect(router.state.location.pathname).toBe(`/learn/lesson/${first?.id ?? ''}/learn`);
    const steps = screen.getByRole('navigation', { name: 'Lesson steps' });
    expect(within(steps).getByRole('link', { name: /Learn/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByRole('heading', { name: 'How to play it' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Common mistakes' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /A guitar with its parts labelled/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /demo/ })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Next: Listen' }));
    expect(await screen.findByText(/Hear how it should sound/)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Next: Practice' }));
    expect(await screen.findByRole('heading', { name: 'Play along' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Next: Check' }));
    expect(await screen.findByText(/passes with one star/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Next:/ })).toBeNull();
  });

  it('shows the chords of a chord lesson with finger numbers', async () => {
    const index = COURSE.lessons.findIndex((lesson) => lesson.id === 'changing-g-c');
    complete([
      ...COURSE.lessons.slice(0, index).map((lesson) => lesson.id),
      COURSE.stages[0]?.test?.id ?? '',
    ]);
    renderRoute('/learn/lesson/changing-g-c/learn');

    expect(await screen.findByRole('heading', { name: 'The chords' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^G major chord: .*finger 2/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^C major chord/ })).toBeInTheDocument();
  });

  it('offers the chord trainer for a chord lesson, coming back to the lesson', async () => {
    const index = COURSE.lessons.findIndex((lesson) => lesson.id === 'changing-g-c');
    complete([
      ...COURSE.lessons.slice(0, index).map((lesson) => lesson.id),
      COURSE.stages[0]?.test?.id ?? '',
    ]);
    renderRoute('/learn/lesson/changing-g-c/practice');

    const trainer = await screen.findByRole('link', { name: 'Open the chord trainer' });
    expect(trainer).toHaveAttribute(
      'href',
      trainerPath({
        chords: ['G', 'C'],
        learn: true,
        back: lessonPath('changing-g-c', 'practice'),
      }),
    );
    expect(screen.getByRole('heading', { name: 'Play along' })).toBeInTheDocument();
  });

  it('opens the stage test once every lesson of the stage is done', async () => {
    const user = userEvent.setup();
    const stage = COURSE.stages[0];
    renderRoute('/learn/stage/first-steps');
    expect(
      await screen.findByText('Complete every lesson in Stage 1 to take the test.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Take the test' })).toBeNull();

    complete(stage?.lessons.map((lesson) => lesson.id) ?? []);
    await user.click(await screen.findByRole('link', { name: 'Take the test' }));
    await screen.findByRole('heading', { level: 1, name: 'Stage 1 test' });
    const parts = within(screen.getByRole('list', { name: 'Parts' })).getAllByRole('listitem');
    expect(parts.map((part) => part.textContent)).toEqual([
      expect.stringContaining('Open strings'),
      expect.stringContaining('Fretted notes'),
      expect.stringContaining('A short melody'),
    ]);
    expect(screen.getByText(/70% passes and opens Stage 2/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start the test' }));
    expect(screen.getByRole('heading', { name: 'Part 1 of 3 · Open strings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('keeps a stage test locked until its lessons are done', async () => {
    renderRoute('/learn/stage/first-steps/test');
    expect(await screen.findByText('This test is locked')).toBeInTheDocument();
  });

  it('points to the stage test when only the test is left', async () => {
    complete(COURSE.stages[0]?.lessons.map((lesson) => lesson.id) ?? []);
    renderRoute('/learn');
    expect(await screen.findByRole('link', { name: 'Take the test' })).toHaveAttribute(
      'href',
      '/learn/stage/first-steps/test',
    );
  });

  it('sends unknown lessons and stages back to the course', async () => {
    renderRoute('/learn/lesson/no-such-lesson/learn');
    expect(await screen.findByText('No such lesson')).toBeInTheDocument();
  });
});

describe('Songs screens', () => {
  it('lists the songs with their origin', async () => {
    const user = userEvent.setup();
    renderRoute('/songs');

    await user.click(await screen.findByRole('link', { name: /Ode to Joy/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ode to Joy' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Public domain · Ludwig van Beethoven/)).toBeInTheDocument();
    expect(screen.getByText('Song chart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});
