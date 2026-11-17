import { useState } from 'react';
import type { ClientCommand, CommandLogEntry, FlightEvent, UploadedMission } from '@droneverse/shared';

export interface LaunchFlowProps {
  preflightPassed: boolean;
  missionId: string | null;
  mission?: UploadedMission | null;
  simulated: boolean;
  events: FlightEvent[];
  commandLog: CommandLogEntry[];
  onCommand: (command: ClientCommand) => boolean;
}

export function canConfirmLaunch(
  areaClear: boolean,
  regulationsFollowed: boolean,
  simulated: boolean,
  acknowledgedSimulated: boolean,
): boolean {
  return (
    areaClear &&
    regulationsFollowed &&
    (!simulated || acknowledgedSimulated)
  );
}

export function LaunchFlow({
  preflightPassed,
  missionId,
  mission,
  simulated,
  events,
  commandLog,
  onCommand,
}: LaunchFlowProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [areaClear, setAreaClear] = useState(false);
  const [regulationsFollowed, setRegulationsFollowed] = useState(false);
  const [acknowledgedSimulated, setAcknowledgedSimulated] = useState(false);
  const sequence = [...events].reverse().find((event) => event.type === 'sequence');
  const alert = [...events].reverse().find((event) => event.type === 'alert');
  const confirmable = canConfirmLaunch(
    areaClear,
    regulationsFollowed,
    simulated,
    acknowledgedSimulated,
  );
  const canSend = missionId !== null;

  const confirm = () => {
    if (!missionId || !mission || !confirmable) return;
    if (!onCommand({ type: 'uploadMission', mission })) return;
    if (
      onCommand({
        type: 'confirmLaunch',
        acknowledgedSimulated: simulated ? acknowledgedSimulated : true,
        areaClear: true,
        regulationsFollowed: true,
        autoSequence: true,
      })
    ) {
      setDialogOpen(false);
    }
  };

  return (
    <section className="mt-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!preflightPassed || !canSend}
          onClick={() => setDialogOpen(true)}
          className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Launch
        </button>
        <button
          type="button"
          disabled={!canSend}
          onClick={() => onCommand({ type: 'returnToHome' })}
          className="rounded-xl border border-amber-500 px-4 py-3 font-semibold text-amber-800 disabled:opacity-40"
        >
          Return to home
        </button>
        <button
          type="button"
          disabled={!canSend}
          onClick={() => onCommand({ type: 'abort' })}
          className="rounded-xl border border-red-500 px-4 py-3 font-semibold text-red-800 disabled:opacity-40"
        >
          Abort
        </button>
      </div>

      {sequence && (
        <p className="mt-3 text-sm text-gray-700">
          Sequence: {sequence.status}
          {sequence.step ? ` · ${sequence.step}` : ''}
          {sequence.reason ? ` · ${sequence.reason}` : ''}
        </p>
      )}
      {alert && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {alert.message}
        </p>
      )}

      <div className="mt-5 rounded-xl border bg-white p-4">
        <h2 className="font-semibold text-gray-900">Command log</h2>
        {commandLog.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No commands yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {commandLog.slice(-8).map((entry) => (
              <li key={entry.id}>
                {entry.command} · {entry.ok ? 'accepted' : `refused: ${entry.error ?? 'unknown reason'}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="launch-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="launch-title" className="text-xl font-bold text-emerald-950">
              Confirm launch
            </h2>
            <label className="mt-4 flex gap-3 text-sm text-gray-800">
              <input type="checkbox" checked={areaClear} onChange={(e) => setAreaClear(e.target.checked)} />
              The area is clear.
            </label>
            <label className="mt-3 flex gap-3 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={regulationsFollowed}
                onChange={(e) => setRegulationsFollowed(e.target.checked)}
              />
              I am following local aviation regulations and permissions.
            </label>
            {simulated && (
              <label className="mt-3 flex gap-3 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={acknowledgedSimulated}
                  onChange={(e) => setAcknowledgedSimulated(e.target.checked)}
                />
                I understand this is a Simulated drone.
              </label>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg px-4 py-2">
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmable}
                onClick={confirm}
                className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                Confirm and launch
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
