import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach } from 'vitest';
import { closeDB } from '@/storage/db';

// jsdom does not implement scrolling; the router's scroll restoration calls it.
// (DSP tests run in the plain Node environment, without a window.)
if (typeof window !== 'undefined') window.scrollTo = () => undefined;

afterEach(async () => {
  cleanup();
  // Fresh, empty IndexedDB for every test.
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
});
