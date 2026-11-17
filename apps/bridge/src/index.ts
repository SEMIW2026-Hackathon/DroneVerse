import type { DroneDriver } from './drivers/DroneDriver.js';
import type { FlightEvent } from '@droneverse/shared';
import { fileURLToPath } from 'node:url';
import { SimDriver } from './drivers/SimDriver.js';
import { connectBridge } from './telemetry/BridgeConnection.js';
import { FlightController } from './flight/FlightController.js';

export interface StartBridgeOptions {
  apiUrl?: string;
  driver?: DroneDriver;
}

export async function startBridge(options: StartBridgeOptions = {}): Promise<() => Promise<void>> {
  const driver: DroneDriver = options.driver ?? new SimDriver();
  let sendEvent: (event: FlightEvent) => void = () => undefined;
  const controller = new FlightController({
    driver,
    emit: (event) => sendEvent(event),
  });
  return connectBridge({
    apiUrl: options.apiUrl ?? process.env.BRIDGE_API_URL ?? 'ws://localhost:3001/ws/bridge',
    driver,
    onCommand: (command) => controller.handle(command),
    onEventSink: (sink) => {
      sendEvent = sink;
    },
    currentMission: () => controller.currentMission(),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void startBridge()
    .then(() => {
      console.log('[bridge] OK: SimDriver connected to API at ws://localhost:3001/ws/bridge');
    })
    .catch((error: unknown) => {
      console.error('droneverse-bridge failed to start', error);
      process.exitCode = 1;
    });
}
