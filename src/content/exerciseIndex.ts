import { COURSE } from './course';
import { EXERCISES, type Exercise } from './exercises';
import { SONGS } from './songs';

/**
 * Every exercise in the app by id: practice exercises, songs, lessons and
 * stage test parts. Ids are unique across all of them (the course checks).
 */
export const ALL_EXERCISES: ReadonlyMap<string, Exercise> = new Map(
  [
    ...EXERCISES,
    ...SONGS.map((song) => song.exercise),
    ...COURSE.lessons.map((lesson) => lesson.exercise),
    ...COURSE.stages.flatMap((stage) => stage.test?.parts.map((part) => part.exercise) ?? []),
  ].map((exercise) => [exercise.id, exercise]),
);
