import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';
import { PATCHES } from './patch-for.js';

/** Reports what is wired up and what is missing, so setup fails loudly rather than silently. */
export async function checkSetup(config) {
  // Both ports time out when nothing is listening, and waiting for one before starting the
  // other doubles how long a failing check takes to report.
  const [agent, loader] = await Promise.all([
    reachable(config.port),
    reachable(config.iosPort),
  ]);

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
      ok: agent,
      detail: `port ${config.port}`,
    }),
    report({
      what: 'ios target',
      ok: Boolean(config.workspace && config.scheme),
      detail: describeTarget(config),
    }),
  ];

  // The rest of the iOS setup only means anything once there is a pod to compile into, and
  // reporting a missing patch file to someone who cannot swap Swift at all is noise.
  if (config.workspace && config.scheme) {
    lines.push(
      report({ what: 'ios loader', ok: loader, detail: `port ${config.iosPort}` }),
      report({
        what: 'ios patch files',
        ok: missingPatches(config.patchDir).length === 0,
        detail: describePatches(config.patchDir),
      }),
    );
  }

  return lines;
}

// Swift and C++ are compiled through the pod the module ships, so an app with no podspec of
// its own has nowhere to put the patch and swaps Kotlin only.
function describeTarget({ workspace, scheme }) {
  if (!workspace) return 'no workspace found, android only';
  if (!scheme) return 'no podspec here; swift and c++ compile through a pod';

  return `${scheme} in ${workspace}`;
}

// A patch file that appeared after the last pod install is invisible to the target, so the
// first swap of that language fails on something that looks unrelated to setup.
function missingPatches(patchDir) {
  return PATCHES.filter(({ file }) => !existsSync(join(patchDir, file)));
}

function describePatches(patchDir) {
  const missing = missingPatches(patchDir);

  return missing.length === 0
    ? 'present, pod install has seen them'
    : `${missing.map(({ file }) => file).join(' and ')} missing; run pod install`;
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
