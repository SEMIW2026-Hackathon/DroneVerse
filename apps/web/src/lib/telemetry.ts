import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clientMessageSchema,
  serverMessageSchema,
  type ClientCommand,
  type CommandLogEntry,
  type CommandResult,
  type FlightEvent,
  type FlightPhase,
  type Telemetry,
} from '@droneverse/shared';
import { pushRenderTelemetry } from '../three/telemetryRenderStore';
import { API_BASE } from './config';

export type TelemetryLinkState =
  | 'connecting'
  | 'connected'
  | 'api-unreachable'
  | 'bridge-offline'
  | 'telemetry-stale';
export const TELEMETRY_UPDATE_INTERVAL_MS = 100;
export const TELEMETRY_STALE_AFTER_MS = 750;

export function isTelemetryFresh(receivedAt: number | null, now = Date.now()): boolean {
  return receivedAt !== null && now - receivedAt <= TELEMETRY_STALE_AFTER_MS;
}

export interface TelemetryLink {
  state: TelemetryLinkState;
  apiReachable: boolean | null;
  bridgeOnline: boolean | null;
  telemetry: Telemetry | null;
  receivedAt: number | null;
  events: FlightEvent[];
  commandLog: CommandLogEntry[];
  phase: FlightPhase | null;
  lastResult: CommandResult | null;
}

function websocketUrl(): string {
  // Production: API_BASE is the full Render address (Vercel can't proxy WebSockets).
  if (/^https?:\/\//.test(API_BASE)) {
    const url = new URL(API_BASE);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws/telemetry`;
  }
  // Local dev: same host as the page, through the dev proxy.
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/telemetry`;
}

export function getTelemetryLinkState(
  apiReachable: boolean | null,
  bridgeOnline: boolean | null,
  receivedAt: number | null,
  now = Date.now(),
): TelemetryLinkState {
  if (apiReachable === false) return 'api-unreachable';
  if (bridgeOnline === false) return 'bridge-offline';
  if (bridgeOnline === true && !isTelemetryFresh(receivedAt, now)) return 'telemetry-stale';
  if (isTelemetryFresh(receivedAt, now)) return 'connected';
  return 'connecting';
}

export function reduceTelemetryMessage(current: TelemetryLink, raw: string): TelemetryLink {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return current;
  }
  const message = serverMessageSchema.safeParse(value);
  if (!message.success) return current;
  if (message.data.type === 'telemetry') {
    return {
      ...current,
      state: 'connected',
      apiReachable: true,
      bridgeOnline: true,
      telemetry: message.data.telemetry,
      receivedAt: Date.now(),
    };
  }
  if (message.data.type === 'event') {
    const event = message.data.event;
    return {
      ...current,
      events: [...current.events, event].slice(-50),
      commandLog:
        event.type === 'commandLog'
          ? [...current.commandLog, event.entry].slice(-50)
          : current.commandLog,
      phase: event.type === 'phase' ? event.phase : current.phase,
    };
  }
  if (message.data.type === 'ack') {
    return { ...current, lastResult: message.data.result };
  }
  if (message.data.type === 'bridge') {
    const bridgeOnline = message.data.online;
    return {
      ...current,
      state: getTelemetryLinkState(current.apiReachable ?? true, bridgeOnline, current.receivedAt),
      apiReachable: current.apiReachable ?? true,
      bridgeOnline,
    };
  }
  return current;
}

export function useTelemetryLink() {
  const [link, setLink] = useState<TelemetryLink>({
    state: 'connecting',
    apiReachable: null,
    bridgeOnline: null,
    telemetry: null,
    receivedAt: null,
    events: [],
    commandLog: [],
    phase: null,
    lastResult: null,
  });
  const socketRef = useRef<WebSocket | null>(null);
  const pendingTelemetryRef = useRef<string | null>(null);
  const telemetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const checkApi = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`API health returned ${response.status}`);
        if (!cancelled) {
          setLink((current) => ({
            ...current,
            apiReachable: true,
            state: getTelemetryLinkState(true, current.bridgeOnline, current.receivedAt),
          }));
        }
      } catch {
        if (!cancelled) {
          setLink((current) => ({
            ...current,
            apiReachable: false,
            state: 'api-unreachable',
          }));
        }
      }
    };
    void checkApi();
    const apiTimer = setInterval(() => void checkApi(), 1_000);
    const socket = new WebSocket(websocketUrl());
    socketRef.current = socket;
    socket.onopen = () =>
      setLink((current) => ({
        ...current,
        state: getTelemetryLinkState(current.apiReachable, current.bridgeOnline, current.receivedAt),
      }));
    socket.onmessage = (event) => {
      let value: unknown;
      try {
        value = JSON.parse(event.data);
      } catch {
        setLink((current) => reduceTelemetryMessage(current, event.data));
        return;
      }
      const parsed = serverMessageSchema.safeParse(value);
      if (parsed.success && parsed.data.type === 'telemetry') {
        pushRenderTelemetry(parsed.data.telemetry);
        pendingTelemetryRef.current = event.data;
        if (telemetryTimerRef.current === null) {
          telemetryTimerRef.current = setTimeout(() => {
            const raw = pendingTelemetryRef.current;
            pendingTelemetryRef.current = null;
            telemetryTimerRef.current = null;
            if (raw !== null) setLink((current) => reduceTelemetryMessage(current, raw));
          }, TELEMETRY_UPDATE_INTERVAL_MS);
        }
        return;
      }
      setLink((current) => reduceTelemetryMessage(current, event.data));
    };
    const markSocketUnavailable = () =>
      setLink((current) => ({
        ...current,
        state: current.apiReachable === false ? 'api-unreachable' : 'bridge-offline',
      }));
    socket.onerror = markSocketUnavailable;
    socket.onclose = markSocketUnavailable;
    const staleTimer = setInterval(() => {
      setLink((current) =>
        current.bridgeOnline === true
          ? {
              ...current,
              state: getTelemetryLinkState(
                current.apiReachable,
                current.bridgeOnline,
                current.receivedAt,
              ),
            }
          : current,
      );
    }, TELEMETRY_UPDATE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(apiTimer);
      socketRef.current = null;
      if (telemetryTimerRef.current !== null) clearTimeout(telemetryTimerRef.current);
      clearInterval(staleTimer);
      socket.close();
    };
  }, []);

  const sendCommand = useCallback((missionId: string, command: ClientCommand) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const requestId = globalThis.crypto?.randomUUID() ?? `${Date.now()}-${Math.random()}`;
    const message = clientMessageSchema.parse({
      type: 'command',
      requestId,
      missionId,
      command,
    });
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  return { ...link, sendCommand };
}