import type { LucideIcon } from 'lucide-react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  /** Keeps the legend for screen readers only, when the context already says it. */
  hideLegend?: boolean;
  /** Radio group name; must be unique on the page. */
  name: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A single-choice control built on native radio inputs, so arrow-key
 * navigation and screen-reader semantics come from the browser.
 */
export function SegmentedControl<T extends string>({
  legend,
  hideLegend = false,
  name,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <fieldset>
      <legend className={hideLegend ? 'sr-only' : 'mb-2 text-sm font-medium text-fg-muted'}>
        {legend}
      </legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-control border border-border bg-track p-1">
        {options.map(({ value: optionValue, label, icon: Icon }) => (
          <label key={optionValue} className="relative">
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={optionValue === value}
              onChange={() => {
                onChange(optionValue);
              }}
              className="peer sr-only"
            />
            <span className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[0.625rem] px-3 text-sm font-medium text-fg-muted transition-colors peer-checked:bg-thumb peer-checked:font-semibold peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text hover:text-fg">
              {Icon && <Icon aria-hidden className="size-4" />}
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
