import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
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
    expect(stages[1]).toHaveTextContent('Complete Stage 1 to unlock');
    expect(stages[3]).toHaveTextContent('Coming soon');
    expect(within(stages[3] ?? document.body).queryByRole('link')).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Start the first lesson' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: first?.title ?? '' }),
    ).toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: 'Practice' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Next: Check' }));
    expect(await screen.findByText(/passes with one star/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Next:/ })).toBeNull();
  });

  it('shows the chords of a chord lesson with finger numbers', async () => {
    const index = COURSE.lessons.findIndex((lesson) => lesson.id === 'changing-g-c');
    complete(COURSE.lessons.slice(0, index).map((lesson) => lesson.id));
    renderRoute('/learn/lesson/changing-g-c/learn');

    expect(await screen.findByRole('heading', { name: 'The chords' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^G major chord: .*finger 2/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^C major chord/ })).toBeInTheDocument();
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
