import { z } from 'zod/mini';

/** Building blocks shared by the content schemas. */

/** Lowercase words joined by hyphens, e.g. "em-am-changes". */
export const slug = z.string().check(z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
export const text = z.string().check(z.minLength(1));

/** Throws with every issue listed, so a content error names exactly what to fix. */
export function parseOrThrow<T>(schema: z.ZodMiniType<T>, data: unknown, what: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`Invalid ${what}:\n${z.prettifyError(result.error)}`);
  return result.data;
}

/** Reports `issues` from a `superRefine` check. */
export function report(issues: readonly string[], ctx: { addIssue: (issue: string) => void }) {
  issues.forEach((issue) => {
    ctx.addIssue(issue);
  });
}
