import {
  bridgeMessageSchema,
  toBridgeMessageSchema,
  type BridgeMessage,
  type BridgeCommand,
  type CommandResult,
  type FlightPhase,
  type FlightEvent,
} from '@droneverse/shared';
import { WebSocket } from 'ws';
import type { DroneDriver } from '../drivers/DroneDriver.js';

export interface BridgeConnectionOptions {
  apiUrl: string;
  driver: Pick<
    DroneDriver,
    'connect' | 'disconnect' | 'info' | 'simulated' | 'onTelemetry'
  >;
  onCommand: (command: BridgeCommand) => Promise<CommandResult>;
  onEventSink?: (send: (event: FlightEvent) => void) => void;
  currentMission?: () => { missionId: string; phase: FlightPhase } | null;
}

export async function connectBridge(options: BridgeConnectionOptions): Promise<() => Promise<void>> {
  const socket = new WebSocket(options.apiUrl);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  const send = (message: BridgeMessage) => {
    socket.send(JSON.stringify(bridgeMessageSchema.parse(message)));
  };
  let commandQueue = Promise.resolve();
  socket.on('message', (raw) => {
    let value: unknown;
    try {
      value = JSON.parse(raw.toString());
    } catch {
      socket.close();
      return;
    }
    const parsed = toBridgeMessageSchema.safeParse(value);
    if (!parsed.success) {
      socket.close();
      return;
    }
    commandQueue = commandQueue
      .then(async () => {
        const result = await options.onCommand(parsed.data.command);
        if (socket.readyState === WebSocket.OPEN) {
          send({ type: 'ack', requestId: parsed.data.requestId, result });
        }
      })
      .catch(() => undefined);
  });
  options.onEventSink?.((event) => {
    if (socket.readyState === WebSocket.OPEN) send({ type: 'event', event });
  });
  const removeTelemetry = options.driver.onTelemetry((telemetry) => {
    if (socket.readyState === WebSocket.OPEN) send({ type: 'telemetry', telemetry });
  });
  socket.once('close', () => {
    void options.driver.disconnect();
  });

  await options.driver.connect();
  send({
    type: 'hello',
    info: { ...options.driver.info(), simulated: options.driver.simulated },
    mission: options.currentMission?.() ?? null,
  });

  return async () => {
    removeTelemetry();
    await options.driver.disconnect();
    if (socket.readyState === WebSocket.OPEN) socket.close();
  };
}
