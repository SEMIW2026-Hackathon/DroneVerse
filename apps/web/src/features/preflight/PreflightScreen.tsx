import { evaluatePreflight, type PreflightResult, type Telemetry } from '@droneverse/shared';
import type { ClientCommand, CommandLogEntry, FlightEvent, UploadedMission } from '@droneverse/shared';
import { LaunchFlow } from './LaunchFlow';

export interface PreflightScreenProps {
  telemetry: Telemetry | null;
  telemetryAgeMs: number;
  mission: { requiredBatteryPct: number } | null;
  uploadedMission?: UploadedMission | null;
  missionId?: string | null;
  events?: FlightEvent[];
  commandLog?: CommandLogEntry[];
  onCommand?: (command: ClientCommand) => boolean;
}

const displayedChecks = ['battery', 'motors', 'gps', 'link'] as const;

export function PreflightScreen({
  telemetry,
  telemetryAgeMs,
  mission,
  uploadedMission = null,
  missionId = null,
  events = [],
  commandLog = [],
  onCommand = () => false,
}: PreflightScreenProps) {
  const result = evaluatePreflight({ telemetry, telemetryAgeMs, mission });
  const checks = result.checks.filter((check) =>
    displayedChecks.includes(check.id as (typeof displayedChecks)[number]),
  );
  const simulated = telemetry?.simulated === true;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Pre-flight check
        </p>
        <h1 className="text-2xl font-bold text-emerald-950">Ready to fly?</h1>
        {simulated && (
          <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900">
            Simulated drone
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {checks.map((check) => (
          <CheckCard key={check.id} check={check} />
        ))}
      </div>

      {!result.passed && (
        <p className="mt-5 text-sm text-red-700">
          Launch is disabled until every pre-flight check passes.
        </p>
      )}
      <LaunchFlow
        preflightPassed={result.passed}
        missionId={missionId}
        mission={uploadedMission}
        simulated={simulated}
        events={events}
        commandLog={commandLog}
        onCommand={onCommand}
      />
    </main>
  );
}

function CheckCard({ check }: { check: PreflightResult['checks'][number] }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        check.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">{check.label}</h2>
        <span className={check.passed ? 'text-emerald-700' : 'text-red-700'}>
          {check.passed ? 'Pass' : 'Fail'}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-700">{check.detail}</p>
    </div>
  );
}
