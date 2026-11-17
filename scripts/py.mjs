// Runs a Python module command using apps/analysis/.venv if it exists, else system python.
// Usage: node ../../scripts/py.mjs -m pytest
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const venvPy =
  process.platform === 'win32'
    ? join(root, 'apps/analysis/.venv/Scripts/python.exe')
    : join(root, 'apps/analysis/.venv/bin/python');
const python = existsSync(venvPy) ? venvPy : 'python';

const result = spawnSync(python, process.argv.slice(2), { stdio: 'inherit' });
process.exit(result.status ?? 1);
