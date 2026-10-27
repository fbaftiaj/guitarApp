import { Check } from 'lucide-react';

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface ChoiceListProps<T extends string> {
  legend: string;
  /** Radio group name; must be unique on the page. */
  name: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A vertical single-choice list built on native radio inputs. */
export function ChoiceList<T extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
}: ChoiceListProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-fg-muted">{legend}</legend>
      <div className="divide-y divide-border overflow-hidden rounded-control border border-border">
        {choices.map((choice) => (
          <label key={choice.value} className="relative block">
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={choice.value === value}
              onChange={() => {
                onChange(choice.value);
              }}
              className="peer sr-only"
            />
            <span className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors peer-checked:bg-accent/10 peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-accent-text hover:bg-surface-raised">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{choice.label}</span>
                {choice.description && (
                  <span className="block text-xs text-fg-muted">{choice.description}</span>
                )}
              </span>
              <Check
                aria-hidden
                className={
                  choice.value === value
                    ? 'size-5 shrink-0 text-accent-text'
                    : 'size-5 shrink-0 opacity-0'
                }
              />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
