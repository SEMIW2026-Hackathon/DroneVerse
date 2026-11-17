import { spawn } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = new Map();
let shuttingDown = false;

function start(name, args) {
  const command = [pnpm, ...args].join(' ');
  const child = spawn(
    process.platform === 'win32' ? process.env.ComSpec : pnpm,
    process.platform === 'win32' ? ['/d', '/s', '/c', command] : args,
    {
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: false,
    },
  );
  children.set(name, child);

  for (const [stream, label] of [
    [child.stdout, 'stdout'],
    [child.stderr, 'stderr'],
  ]) {
    let pending = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        if (line) console.log(`[${name}] ${line}`);
      }
    });
    stream.on('end', () => {
      if (pending) console.log(`[${name}] ${pending}`);
    });
    stream.on('error', (error) => {
      console.error(`[dev:${label}] ${error.message}`);
    });
  }

  child.on('exit', (code, signal) => {
    children.delete(name);
    if (!shuttingDown && code !== 0) {
      console.error(`[${name}] exited with ${signal ?? `code ${code}`}`);
      void shutdown(code ?? 1);
    }
  });

  return child;
}

async function waitForApi() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) return;
    } catch {
      // The API is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('API did not become ready within 30 seconds');
}

async function waitForWeb() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://localhost:5173');
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Web app did not become ready within 30 seconds');
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children.values()) child.kill();
  process.exitCode = code;
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

try {
  start('api', ['--filter', '@droneverse/api', 'dev']);
  await waitForApi();
  console.log('[dev] API ready on http://localhost:3001');
  start('bridge', ['--filter', '@droneverse/bridge', 'dev']);
  start('web', ['--filter', '@droneverse/web', 'dev']);
  await waitForWeb();
  console.log('[dev] Startup summary: web OK on port 5173, api OK on port 3001, bridge OK (SimDriver)');
} catch (error) {
  console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
  await shutdown(1);
}
