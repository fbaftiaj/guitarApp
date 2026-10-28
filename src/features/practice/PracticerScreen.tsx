import { Music } from 'lucide-react';
import { useParams } from 'react-router';
import { PRACTICE_PATH } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { findExercise } from '@/content/exercises';
import { ButtonLink } from '@/ui/ButtonLink';
import { EmptyState } from '@/ui/EmptyState';
import { Practicer } from './Practicer';

export function PracticerScreen() {
  const { exerciseId = '' } = useParams();
  const exercise = findExercise(exerciseId);
  if (!exercise) {
    return (
      <Screen title="Exercise not found" backTo={PRACTICE_PATH} backLabel="All exercises">
        <EmptyState
          icon={Music}
          title="No such exercise"
          description="This exercise doesn’t exist. It may have been renamed or removed."
          action={<ButtonLink to={PRACTICE_PATH}>All exercises</ButtonLink>}
        />
      </Screen>
    );
  }
  return (
    <Screen title={exercise.title} backTo={PRACTICE_PATH} backLabel="All exercises">
      {/* A new exercise gets a fresh session. */}
      <Practicer key={exercise.id} exercise={exercise} />
    </Screen>
  );
}
