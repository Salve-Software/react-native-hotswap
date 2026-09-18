import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';

/** Reports what is wired up and what is missing, so setup fails loudly rather than silently. */
export async function checkSetup(config) {
  const lines = [
    report('gradle project', existsSync(config.project), config.project),
    report('kotlin sources', existsSync(config.watch[0]), config.watch[0]),
    report('nitro spec', existsSync(config.specs), 'guard is active'),
    report('android device', hasDevice(), 'adb devices'),
    report('agent reachable', await reachable(config.port), `port ${config.port}`),
    report('ios workspace', Boolean(config.workspace), config.workspace ?? 'none found'),
  ];

  return lines;
}

function report(what, ok, detail) {
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
