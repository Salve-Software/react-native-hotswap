import { connect } from 'node:net';

const REPLY = 30000;
const PROBE = 1500;

/** The half of hotswap that lives inside the running app, reached over a loopback socket. */
export class Agent {
  constructor(private readonly port: number) {}

  /** Sends one request and resolves with the single status byte that comes back. */
  send(payload: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: '127.0.0.1', port: this.port });

      // The agent closes the connection on a malformed message without replying, and
      // without a deadline the caller would wait for a response that is never coming.
      socket.setTimeout(REPLY);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('the agent did not reply'));
      });
      socket.on('close', () => reject(new Error('the agent closed the connection')));
      socket.on('error', reject);

      socket.on('connect', () => socket.write(payload));

      socket.once('data', (reply: Buffer) => {
        socket.end();
        resolve(reply.readUInt8(0));
      });
    });
  }

  /** Whether anything is listening, which is how a platform in play is told from one that is not. */
  listening(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ host: '127.0.0.1', port: this.port });

      socket.setTimeout(PROBE);
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
}
