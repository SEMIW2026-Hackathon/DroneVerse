import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { UploadedMission } from '@droneverse/shared';
import type { ClientCommand } from '@droneverse/shared';
import { api } from '../../lib/api';
import { useTelemetryLink } from '../../lib/telemetry';
import { PreflightScreen } from './PreflightScreen';

export function PreflightPage() {
  const [params] = useSearchParams();
  const missionId = params.get('missionId');
  const link = useTelemetryLink();
  const [mission, setMission] = useState<UploadedMission | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!missionId) return;
    api.getMission(missionId).then(({ mission: loaded }) => setMission(loaded)).catch((e: Error) => setError(e.message));
  }, [missionId]);
  const telemetryAgeMs = useMemo(() => {
    if (link.state !== 'connected' || link.receivedAt === null) return Infinity;
    return Date.now() - link.receivedAt;
  }, [link.state, link.receivedAt]);

  if (!missionId || error || !mission) {
    return <p className="mx-auto max-w-2xl p-6 text-red-700">{error ?? 'Open pre-flight from a generated mission plan.'}</p>;
  }
  const onCommand = (command: ClientCommand) => link.sendCommand(missionId, command);
  return (
    <PreflightScreen
      telemetry={link.telemetry}
      telemetryAgeMs={telemetryAgeMs}
      mission={mission}
      uploadedMission={mission}
      missionId={missionId}
      events={link.events}
      commandLog={link.commandLog}
      onCommand={onCommand}
    />
  );
}
