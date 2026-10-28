import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup, configure } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach } from 'vitest';
import { closeDB } from '@/storage/db';

// Route tests wait for lazily imported screens, which are compiled on first use;
// on a cold run (or a slow CI machine) that can exceed the 1 s default.
configure({ asyncUtilTimeout: 3000 });

// jsdom does not implement scrolling; the router's scroll restoration calls it.
// (DSP tests run in the plain Node environment, without a window.)
if (typeof window !== 'undefined') window.scrollTo = () => undefined;

afterEach(async () => {
  cleanup();
  // Fresh, empty IndexedDB for every test.
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
});
