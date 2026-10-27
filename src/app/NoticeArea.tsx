import { StorageWarning } from './StorageWarning';
import { UpdatePrompt } from './pwa/UpdatePrompt';

/** Fixed stack of app-level notices, above the tab bar on phones. */
export function NoticeArea() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+0.75rem)] z-40 mx-auto flex max-w-md flex-col gap-2 px-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96 lg:px-0">
      <StorageWarning />
      <UpdatePrompt />
    </div>
  );
}
