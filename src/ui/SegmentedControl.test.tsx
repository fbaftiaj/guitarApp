import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'slow', label: 'Slow' },
  { value: 'fast', label: 'Fast' },
] as const;

type Speed = (typeof OPTIONS)[number]['value'];

function Harness({ onChange }: { onChange: (value: Speed) => void }) {
  const [value, setValue] = useState<Speed>('slow');
  return (
    <SegmentedControl
      legend="Speed"
      name="speed"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('SegmentedControl', () => {
  it('is a labelled radio group reflecting the current value', () => {
    render(<Harness onChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Speed' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Slow' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Fast' })).not.toBeChecked();
  });

  it('reports a new selection from a click or the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByText('Fast'));
    expect(onChange).toHaveBeenLastCalledWith('fast');
    expect(screen.getByRole('radio', { name: 'Fast' })).toBeChecked();

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('slow');
  });
});
