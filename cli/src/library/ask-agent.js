import { connect } from 'node:net';

/** Sends one request to an agent on the device and resolves with its single status byte. */
export function askAgent(port, payload) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });

    // The agent closes the connection on a malformed message without replying, and without
    // a deadline the caller would wait for a response that is never coming.
    socket.setTimeout(30000);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('the agent did not reply'));
    });
    socket.on('close', () => reject(new Error('the agent closed the connection')));
    socket.on('error', reject);

    socket.on('connect', () => socket.write(payload));

    socket.once('data', (reply) => {
      socket.end();
      resolve(reply.readUInt8(0));
    });
  });
}

/** Length-prefixed the way every frame in these protocols is. */
export function framed(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);

  return Buffer.concat([length, bytes]);
}
