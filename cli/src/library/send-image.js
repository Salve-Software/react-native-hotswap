import { connect } from 'node:net';

/** Sends one dylib path to the iOS loader and resolves with its status byte. */
export function sendImage(path, port) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });

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
