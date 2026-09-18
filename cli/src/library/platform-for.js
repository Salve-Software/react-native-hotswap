/** Which platform knows how to replace a saved file, if any does. */
export function platformFor(path) {
  if (path.endsWith('.kt')) return 'android';
  if (path.endsWith('.swift')) return 'ios';

  return undefined;
}
