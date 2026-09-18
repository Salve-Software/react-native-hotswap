import { connect } from 'node:net'

/** Sends one class redefinition to the agent and resolves with its jvmtiError. */
export function sendRedefinition({ className, dex }, port) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port })

    socket.on('error', reject)

    socket.on('connect', () => {
      const name = Buffer.from(className, 'utf8')
      const head = Buffer.alloc(4)
      const size = Buffer.alloc(4)

      head.writeUInt32BE(name.length)
      size.writeUInt32BE(dex.length)

      socket.write(Buffer.concat([head, name, size, dex]))
    })

    socket.once('data', (reply) => {
      socket.end()
      resolve(reply.readUInt8(0))
    })
  })
}
