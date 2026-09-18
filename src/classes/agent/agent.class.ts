import { connect } from 'node:net';

const REPLY = 30000;
const PROBE = 1500;

export class Agent {
  constructor(private readonly port: number) {}

  send(payload: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: '127.0.0.1', port: this.port });

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
