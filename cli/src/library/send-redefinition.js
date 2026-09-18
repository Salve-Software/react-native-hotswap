import { askAgent, framed } from './ask-agent.js';

const CLASSES = 0;

/** Sends a batch of class redefinitions to the agent and resolves with its jvmtiError. */
export function sendRedefinition(definitions, port) {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(definitions.length);

  return askAgent(
    port,
    Buffer.concat([Buffer.from([CLASSES]), count, ...definitions.map(frame)]),
  );
}

function frame({ className, dex }) {
  return Buffer.concat([framed(className), framed(dex)]);
}
