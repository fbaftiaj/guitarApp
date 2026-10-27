import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStorageStatus } from '@/storage/storageStatus';
import { StorageWarning } from './StorageWarning';

describe('StorageWarning', () => {
  beforeEach(() => {
    useStorageStatus.setState({ failed: false });
  });

  it('appears when storage fails and can be dismissed', async () => {
    const user = userEvent.setup();
    render(<StorageWarning />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      useStorageStatus.setState({ failed: true });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Progress can’t be saved right now');

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
