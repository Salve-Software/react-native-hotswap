interface Answered {
  port: number;
  listening: boolean;
  app: string | undefined;
}

/** What answered on the port, and whether it is the app this project builds. */
export function readAgent(
  expected: string | undefined,
  { port, listening, app }: Answered,
): { ok: boolean; detail: string } {
  if (!listening) return { ok: false, detail: `port ${port}` };

  if (!app)
    return { ok: true, detail: `port ${port}, an agent too old to say which app` };

  if (expected && app !== expected) {
    return { ok: false, detail: `port ${port} is held by ${app}, not ${expected}` };
  }

  return { ok: true, detail: `port ${port}, ${app}` };
}
