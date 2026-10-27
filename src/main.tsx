import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { applyTheme, resolveTheme, systemPrefersLight } from '@/app/theme';
import { useSettingsStore, whenSettingsHydrated } from '@/stores/settingsStore';
import './index.css';

async function bootstrap(): Promise<void> {
  // Load persisted settings before the first paint so the saved theme is
  // applied without a flash of the default one.
  await whenSettingsHydrated();
  applyTheme(resolveTheme(useSettingsStore.getState().theme, systemPrefersLight()));

  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
