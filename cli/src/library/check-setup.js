import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';

/** Reports what is wired up and what is missing, so setup fails loudly rather than silently. */
export async function checkSetup(config) {
  const lines = [
    report({
      what: 'gradle project',
      ok: existsSync(config.project),
      detail: config.project,
    }),
    report({
      what: 'kotlin sources',
      ok: existsSync(config.watch[0]),
      detail: config.watch[0],
    }),
    report({
      what: 'nitro spec',
      ok: true,
      detail: existsSync(config.specs) ? 'guard is active' : 'none, nothing to guard',
    }),
    report({ what: 'android device', ok: hasDevice(), detail: 'adb devices' }),
    report({
      what: 'agent reachable',
      ok: await reachable(config.port),
      detail: `port ${config.port}`,
    }),
    report({
      what: 'ios workspace',
      ok: true,
      detail: config.workspace ?? 'none found, android only',
    }),
  ];

  return lines;
}

function report({ what, ok, detail }) {
  return `  ${ok ? '✅' : '⛔'} ${what.padEnd(18)} ${detail}`;
}

function hasDevice() {
  try {
    return (
      execFileSync('adb', ['devices'], { encoding: 'utf8' }).trim().split('\n').length > 1
    );
  } catch {
    return false;
  }
}

function reachable(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });

    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}
