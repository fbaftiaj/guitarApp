import { Navigate } from 'react-router';
import { HOME_PATH, WELCOME_PATH } from '@/app/navigation';
import { useSettingsStore } from '@/stores/settingsStore';

/** The app's start: setup on first launch, the tuner after that. */
export function StartRedirect() {
  const onboarded = useSettingsStore((state) => state.onboarded);
  return <Navigate to={onboarded ? HOME_PATH : WELCOME_PATH} replace />;
}
