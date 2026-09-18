/** Splits a recorded compile command into arguments, respecting how it was quoted. */
export function splitCommand(command) {
  const parts = [];
  let current = '';
  let quote = '';
  let started = false;

  for (let i = 0; i < command.length; i++) {
    const character = command[i];

    if (character === '\\' && i + 1 < command.length) {
      current += command[++i];
      started = true;
      continue;
    }

    if (quote) {
      if (character === quote) quote = '';
      else current += character;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      started = true;
      continue;
    }

    if (character === ' ' || character === '\t') {
      if (started) parts.push(current);
      current = '';
      started = false;
      continue;
    }

    current += character;
    started = true;
  }

  if (started) parts.push(current);

  return parts;
}
