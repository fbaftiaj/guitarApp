import type { useRegisterSW as useRegisterSWType } from 'virtual:pwa-register/react';

/**
 * Stand-in for the PWA plugin's virtual module, which only exists in real
 * builds. Tests that need other states mock this module with `vi.mock`.
 */
export const useRegisterSW: typeof useRegisterSWType = () => ({
  needRefresh: [false, () => undefined],
  offlineReady: [false, () => undefined],
  updateServiceWorker: () => Promise.resolve(),
});
