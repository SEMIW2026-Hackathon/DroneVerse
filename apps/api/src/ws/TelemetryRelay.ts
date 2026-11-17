import {
  bridgeMessageSchema,
  clientMessageSchema,
  toBridgeMessageSchema,
  serverMessageSchema,
  type BridgeInfo,
  type CommandResult,
  type ServerMessage,
} from '@droneverse/shared';
import type { WebSocket } from 'ws';

type RelaySocket = Pick<WebSocket, 'send'> & Partial<Pick<WebSocket, 'close'>>;

const encode = (message: ServerMessage) =>
  JSON.stringify(serverMessageSchema.parse(message));

export class TelemetryRelay {
  private bridge: RelaySocket | null = null;
  private bridgeInfo: BridgeInfo | null = null;
  private readonly browsers = new Set<RelaySocket>();
  private readonly pending = new Map<string, RelaySocket>();

  attachBridge(socket: RelaySocket): void {
    this.bridge?.close?.();
    this.bridge = socket;
    this.bridgeInfo = null;
  }

  disconnectBridge(socket: RelaySocket): void {
    if (this.bridge !== socket) return;
    this.bridge = null;
    this.bridgeInfo = null;
    this.broadcast({
      type: 'bridge',
      online: false,
      info: null,
      busy: false,
    });
  }

  addBrowser(socket: RelaySocket): void {
    this.browsers.add(socket);
    this.send(socket, this.bridgeStatus());
  }

  removeBrowser(socket: RelaySocket): void {
    this.browsers.delete(socket);
    for (const [requestId, browser] of this.pending) {
      if (browser === socket) this.pending.delete(requestId);
    }
  }

  receiveBrowser(socket: RelaySocket, raw: string): void {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      socket.close?.();
      return;
    }
    const parsed = clientMessageSchema.safeParse(value);
    if (!parsed.success) {
      socket.close?.();
      return;
    }
    if (parsed.data.type !== 'command') return;

    if (!this.bridge || !this.bridgeInfo) {
      this.send(socket, {
        type: 'ack',
        requestId: parsed.data.requestId,
        result: this.failure('The drone bridge is offline'),
      });
      return;
    }
    const message = toBridgeMessageSchema.parse({
      type: 'command',
      requestId: parsed.data.requestId,
      command: parsed.data.command,
    });
    this.pending.set(parsed.data.requestId, socket);
    try {
      this.bridge.send(JSON.stringify(message));
    } catch {
      this.pending.delete(parsed.data.requestId);
      this.send(socket, {
        type: 'ack',
        requestId: parsed.data.requestId,
        result: this.failure('The drone bridge could not receive the command'),
      });
    }
  }

  receiveBridge(socket: RelaySocket, raw: string): void {
    if (socket !== this.bridge) return;

    let message: unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      socket.close?.();
      return;
    }
    const parsed = bridgeMessageSchema.safeParse(message);
    if (!parsed.success) {
      socket.close?.();
      return;
    }

    switch (parsed.data.type) {
      case 'hello':
        this.bridgeInfo = parsed.data.info;
        this.broadcast(this.bridgeStatus());
        break;
      case 'telemetry':
        this.broadcast({ type: 'telemetry', telemetry: parsed.data.telemetry });
        break;
      case 'event':
        this.broadcast({ type: 'event', event: parsed.data.event });
        break;
      case 'ack': {
        const browser = this.pending.get(parsed.data.requestId);
        if (browser) {
          this.send(browser, {
            type: 'ack',
            requestId: parsed.data.requestId,
            result: parsed.data.result,
          });
        }
        this.pending.delete(parsed.data.requestId);
        break;
      }
    }
  }

  private bridgeStatus(): ServerMessage {
    return {
      type: 'bridge',
      online: this.bridge !== null && this.bridgeInfo !== null,
      info: this.bridgeInfo,
      busy: false,
    };
  }

  private broadcast(message: ServerMessage): void {
    const encoded = encode(message);
    for (const browser of this.browsers) this.sendEncoded(browser, encoded);
  }

  private send(socket: RelaySocket, message: ServerMessage): void {
    this.sendEncoded(socket, encode(message));
  }

  private failure(error: string): CommandResult {
    return { ok: false, error };
  }

  private sendEncoded(socket: RelaySocket, encoded: string): void {
    try {
      socket.send(encoded);
    } catch {
      this.browsers.delete(socket);
    }
  }
}
