import { askAgent, framed } from './ask-agent.js';

/** Sends one dylib path to the iOS loader and resolves with its status byte. */
export function sendImage(path, port) {
  return askAgent(port, framed(path));
}
