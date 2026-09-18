import { connect } from 'node:net';

/** Sends a batch of class redefinitions to the agent and resolves with its jvmtiError. */
export function sendRedefinition(definitions, port) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });

    socket.on('error', reject);

    socket.on('connect', () => {
      const count = Buffer.alloc(4);
      count.writeUInt32BE(definitions.length);

      socket.write(Buffer.concat([count, ...definitions.map(frame)]));
    });

    socket.once('data', (reply) => {
      socket.end();
      resolve(reply.readUInt8(0));
    });
  });
}

function frame({ className, dex }) {
  const name = Buffer.from(className, 'utf8');
  const nameLength = Buffer.alloc(4);
  const dexLength = Buffer.alloc(4);

  nameLength.writeUInt32BE(name.length);
  dexLength.writeUInt32BE(dex.length);

  return Buffer.concat([nameLength, name, dexLength, dex]);
}
