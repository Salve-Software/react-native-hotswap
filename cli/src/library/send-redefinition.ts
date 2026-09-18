import { connect } from 'node:net'

/**
 * Sends one class redefinition to the agent and resolves with its jvmtiError.
 *
 * Wire format, all big endian: [u32 nameLength][name][u32 dexLength][dex].
 * The reply is a single byte, 0 meaning the class was redefined.
 */
export function sendRedefinition(
  target: { className: string; dex: Buffer },
  port: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port })

    socket.on('error', reject)

    socket.on('connect', () => {
      const name = Buffer.from(target.className, 'utf8')
      const header = Buffer.alloc(4)
      const dexLength = Buffer.alloc(4)

      header.writeUInt32BE(name.length)
      dexLength.writeUInt32BE(target.dex.length)

      socket.write(Buffer.concat([header, name, dexLength, target.dex]))
    })

    socket.once('data', (reply) => {
      socket.end()
      resolve(reply.readUInt8(0))
    })
  })
}
