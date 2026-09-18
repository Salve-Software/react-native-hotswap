import { connect } from 'node:net';

/** Sends one dylib path to the iOS loader and resolves with its status byte. */
export function sendImage(path, port) {
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

    socket.on('connect', () => {
      const name = Buffer.from(path, 'utf8');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(name.length);

      socket.write(Buffer.concat([length, name]));
    });

    socket.once('data', (reply) => {
      socket.end();
      resolve(reply.readUInt8(0));
    });
  });
}
