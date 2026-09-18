import { connect } from 'node:net';

/** Whether something is listening, used to tell a platform in play from one that is not. */
export function reachable(port) {
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
