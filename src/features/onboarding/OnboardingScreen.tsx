import {
  ArrowLeft,
  ArrowRight,
  Gauge,
  GraduationCap,
  Headphones,
  Mic,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { HOME_PATH, LEARN_PATH, TUNER_PATH } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ChoiceList } from '@/ui/ChoiceList';
import { cx } from '@/ui/cx';
import { LatencyCalibration } from '../settings/LatencyScreen';
import { EXPERIENCE, placementText, startStageFor, type Experience } from './placement';

const STEPS = ['experience', 'microphone', 'latency', 'tune'] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, string> = {
  experience: 'Where are you starting from?',
  microphone: 'FretPath listens while you play',
  latency: 'Make timing scores fair',
  tune: 'Tune your guitar',
};

function Point({ icon: Icon, children }: { icon: typeof Mic; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-text" />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

/**
 * First-launch setup in four short steps: experience (which places the
 * player at a stage), what the microphone is for, latency calibration and
 * tuning. Every step can be skipped; Settings can run it again.
 */
export function OnboardingScreen() {
  const navigate = useNavigate();
  const completeOnboarding = useSettingsStore((state) => state.completeOnboarding);
  const savedStage = useSettingsStore((state) => state.startStage);
  const [experience, setExperience] = useState<Experience>(
    EXPERIENCE.find((choice) => choice.stage === savedStage)?.value ?? 'new',
  );
  const [index, setIndex] = useState(0);
  const step = STEPS[index] ?? 'experience';

  // Each new step's heading gets focus, so screen readers announce it.
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [index]);

  const finish = (to: string) => {
    completeOnboarding(startStageFor(experience));
    void navigate(to, { replace: true });
  };
  const next = () => {
    setIndex((current) => Math.min(STEPS.length - 1, current + 1));
  };

  return (
    <Screen
      title="Get started"
      actions={
        <Button
          variant="ghost"
          onClick={() => {
            finish(HOME_PATH);
          }}
          className="-mr-2"
        >
          Skip setup
        </Button>
      }
    >
      <div className="mb-5 flex items-center gap-3">
        <ol aria-hidden className="flex gap-1.5">
          {STEPS.map((candidate, i) => (
            <li
              key={candidate}
              className={cx(
                'h-1.5 w-8 rounded-full',
                i <= index
                  ? 'bg-accent forced-colors:bg-[Highlight]'
                  : 'bg-surface-raised forced-colors:border forced-colors:border-[CanvasText]',
              )}
            />
          ))}
        </ol>
        <p className="text-sm text-fg-muted">
          Step {index + 1} of {STEPS.length}
        </p>
      </div>
      <h2 ref={heading} tabIndex={-1} className="mb-4 text-2xl font-bold outline-none">
        {TITLES[step]}
      </h2>

      {step === 'experience' && (
        <div className="space-y-4">
          <p className="text-pretty text-fg-muted">
            FretPath’s course runs from your first notes to playing complete songs. Tell it where
            you are, and it starts you at the right stage. You can still play every earlier lesson.
          </p>
          <ChoiceList
            legend="How much have you played?"
            name="experience"
            choices={EXPERIENCE.map((choice) => ({
              value: choice.value,
              label: choice.label,
              description: placementText(choice.value),
            }))}
            value={experience}
            onChange={setExperience}
          />
          <Button size="lg" fullWidth icon={ArrowRight} onClick={next}>
            Continue
          </Button>
        </div>
      )}

      {step === 'microphone' && (
        <div className="space-y-4">
          <Card>
            <ul className="space-y-4">
              <Point icon={Mic}>
                When you play along, the microphone lets FretPath hear each strum and note, so it
                can tell you whether it was on time and the right chord. The tuner uses it too.
              </Point>
              <Point icon={ShieldCheck}>
                Sound is analysed on this device only. Nothing is recorded, stored or sent anywhere.
              </Point>
              <Point icon={Headphones}>
                Your browser asks for permission the first time. Wired headphones, or a lower
                volume, stop FretPath from hearing its own clicks.
              </Point>
            </ul>
          </Card>
          <Button size="lg" fullWidth icon={ArrowRight} onClick={next}>
            Continue
          </Button>
        </div>
      )}

      {step === 'latency' && (
        <div className="space-y-4">
          <LatencyCalibration onSaved={next} />
          <Button variant="secondary" fullWidth onClick={next}>
            Skip for now
          </Button>
        </div>
      )}

      {step === 'tune' && (
        <div className="space-y-4">
          <Card className="space-y-3 text-pretty">
            <p>
              Even perfect playing sounds wrong on an out-of-tune guitar, and the lesson checks
              listen for the right pitch. Tune before you start, and before every session.
            </p>
            <p className="text-sm text-fg-muted">
              Tap “Tap to tune”, play each string and turn its peg until the tuner says it’s in
              tune.
            </p>
          </Card>
          <div className="grid gap-2">
            <Button
              size="lg"
              icon={Gauge}
              onClick={() => {
                finish(TUNER_PATH);
              }}
            >
              Open the tuner
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={GraduationCap}
              onClick={() => {
                finish(LEARN_PATH);
              }}
            >
              My guitar is in tune: start learning
            </Button>
          </div>
        </div>
      )}

      {index > 0 && (
        <Button
          variant="ghost"
          icon={ArrowLeft}
          className="mt-4 -ml-2"
          onClick={() => {
            setIndex((current) => Math.max(0, current - 1));
          }}
        >
          Back
        </Button>
      )}
    </Screen>
  );
}
