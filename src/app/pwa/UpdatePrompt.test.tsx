import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { UpdatePrompt } from './UpdatePrompt';

vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }));

const setNeedRefresh = vi.fn();
const setOfflineReady = vi.fn();
const updateServiceWorker = vi.fn(() => Promise.resolve());

function mockState({ needRefresh = false, offlineReady = false }) {
  vi.mocked(useRegisterSW).mockReturnValue({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  });
}

describe('UpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing while there is no news', () => {
    mockState({});
    const { container } = render(<UpdatePrompt />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lets the user apply a waiting update', async () => {
    const user = userEvent.setup();
    mockState({ needRefresh: true });
    render(<UpdatePrompt />);

    expect(screen.getByRole('status')).toHaveTextContent('A new version of FretPath is available.');
    await user.click(screen.getByRole('button', { name: 'Reload to update' }));

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('lets the user postpone the update', async () => {
    const user = userEvent.setup();
    mockState({ needRefresh: true });
    render(<UpdatePrompt />);

    await user.click(screen.getByRole('button', { name: 'Later' }));

    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('announces offline readiness once and can be dismissed', async () => {
    const user = userEvent.setup();
    mockState({ offlineReady: true });
    render(<UpdatePrompt />);

    expect(screen.getByRole('status')).toHaveTextContent('ready to work offline');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(setOfflineReady).toHaveBeenCalledWith(false);
  });
});
