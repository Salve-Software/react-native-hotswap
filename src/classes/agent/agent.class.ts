import { connect } from 'node:net';
import { PROBE, REPLY } from './constants/index.js';

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

  identify(kind: number): Promise<string | undefined> {
    return new Promise((resolve) => {
      const socket = connect({ host: '127.0.0.1', port: this.port });
      const done = (name?: string): void => {
        socket.destroy();
        resolve(name);
      };

      socket.setTimeout(REPLY);
      socket.on('timeout', () => done());
      socket.on('error', () => done());
      socket.on('close', () => resolve(undefined));

      socket.on('connect', () => socket.write(Buffer.from([kind])));

      socket.once('data', (reply: Buffer) => {
        const length = reply.length < 4 ? 0 : reply.readUInt32BE(0);

        done(length === 0 ? undefined : reply.toString('utf8', 4, 4 + length));
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
