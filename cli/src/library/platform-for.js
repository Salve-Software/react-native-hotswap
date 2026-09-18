const NATIVE = ['.cpp', '.cc', '.cxx'];

/** Which platform knows how to replace a saved file, if any does. */
export function platformFor(path) {
  if (path.endsWith('.kt')) return 'android';
  if (path.endsWith('.swift')) return 'ios';

  // Objective-C++ is deliberately absent: including a .mm into the patch would define its
  // classes a second time, and the runtime resolves that by picking one at random.
  if (NATIVE.some((extension) => path.endsWith(extension))) return 'ios';

  return undefined;
}
