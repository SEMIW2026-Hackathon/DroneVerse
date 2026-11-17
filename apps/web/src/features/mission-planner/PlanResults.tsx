import type { PlanResult, RiskSeverity } from '@droneverse/shared';

const SEVERITY_STYLE: Record<RiskSeverity, { box: string; label: string }> = {
  critical: { box: 'border-red-300 bg-red-50 text-red-900', label: 'Blocks launch' },
  warning: { box: 'border-amber-300 bg-amber-50 text-amber-900', label: 'Warning' },
  info: { box: 'border-gray-200 bg-gray-50 text-gray-700', label: 'Note' },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

const fmtDistance = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

export function PlanResults({ result }: { result: PlanResult }) {
  const s = result.stats;
  const used = Math.max(0, Math.min(100, s.batteryUsedPct));
  const limit = 100 - s.reservePct;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl p-3 text-sm font-medium ${
          result.canLaunch ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
        }`}
      >
        {result.canLaunch
          ? 'Plan passes the safety checks. Pre-flight checks come before any launch.'
          : 'This plan cannot be flown as it is. Fix the issues below.'}
      </div>

      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span>Battery used (including the trip home)</span>
          <span className="font-semibold">{Math.round(s.batteryUsedPct)}%</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full ${s.batteryUsedPct > limit ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${used}%` }}
          />
          <div className="absolute inset-y-0 w-0.5 bg-gray-800" style={{ left: `${limit}%` }} />
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Black line: the {s.reservePct}% safety reserve must stay untouched. About{' '}
          {Math.round(Math.max(0, s.batteryRemainingPct))}% would be left on landing.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Flight time" value={`${s.flightTimeMin.toFixed(1)} min`} />
        <Stat label="Area" value={`${s.areaHa.toFixed(2)} ha`} />
        <Stat label="Distance flown" value={fmtDistance(s.totalDistanceM)} />
        <Stat label="Photos" value={`about ${s.photoCount}`} />
        <Stat label="Photo detail" value={`${s.gsdCmPerPx.toFixed(1)} cm/pixel`} />
        <Stat label="Waypoints" value={String(s.waypointCount)} />
      </div>

      <ul className="space-y-2">
        {result.risks.map((r) => (
          <li
            key={r.code}
            className={`rounded-xl border p-3 text-sm ${SEVERITY_STYLE[r.severity].box}`}
          >
            <div className="mb-0.5 text-xs font-semibold uppercase">
              {SEVERITY_STYLE[r.severity].label}
            </div>
            {r.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
