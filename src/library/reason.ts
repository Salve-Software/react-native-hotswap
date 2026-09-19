const LIMIT = 200;

/** The line worth printing from a failure, since a compiler's own command line is not one. */
export function reason(cause: unknown): string {
  const failure = cause as { stderr?: unknown; message?: unknown };
  const output = text(failure.stderr);

  return trim(
    compilerError(output) ?? firstLine(output) ?? firstLine(text(failure.message)),
  );
}

function compilerError(output: string | undefined): string | undefined {
  return output
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => /^[^:]*:\d+:\d+: error: |^error: /.test(line));
}

function firstLine(output: string | undefined): string | undefined {
  return output
    ?.split('\n')
    .map((line) => line.trim())
    .find(Boolean);
}

function text(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;

  const asText = (value as { toString(): string }).toString().trim();

  return asText.length === 0 ? undefined : asText;
}

function trim(line: string | undefined): string {
  if (!line) return 'failed, with nothing to say why';

  return line.length > LIMIT ? `${line.slice(0, LIMIT)}…` : line;
}
