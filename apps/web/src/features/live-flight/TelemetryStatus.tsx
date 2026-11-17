import { useTelemetryLink } from '../../lib/telemetry';

const statusCopy = {
  connecting: {
    label: 'Connecting to drone telemetry…',
    hint: 'Waiting for the API and bridge status.',
  },
  connected: {
    label: 'Telemetry connected',
    hint: '',
  },
  'api-unreachable': {
    label: 'API unreachable',
    hint: 'Start pnpm dev and check that the API is running on port 3001.',
  },
  'bridge-offline': {
    label: 'API connected, bridge offline',
    hint: 'Start or reconnect the SimDriver bridge; the web app is reaching the API.',
  },
  'telemetry-stale': {
    label: 'Bridge connected, telemetry stale',
    hint: 'Check the bridge logs and restart the bridge if telemetry is not updating.',
  },
} as const;

export function TelemetryStatus() {
  const { state, telemetry, receivedAt } = useTelemetryLink();
  const copy = statusCopy[state];
  const label = telemetry?.simulated ? `${copy.label} · Simulated` : copy.label;
  const lastUpdated = receivedAt
    ? new Date(receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`px-4 py-2 text-sm ${
        state === 'connected' ? 'bg-white/90 text-gray-700' : 'bg-red-100 text-red-800'
      }`}
    >
      {label}
      {copy.hint ? <span className="ml-3">{copy.hint}</span> : null}
      {state === 'connected' && telemetry && lastUpdated ? (
        <span className="ml-3" data-testid="telemetry-timestamp">
          Last update {lastUpdated}
        </span>
      ) : null}
    </div>
  );
}
