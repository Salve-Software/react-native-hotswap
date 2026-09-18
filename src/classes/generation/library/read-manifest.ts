import { readFileSync } from 'node:fs';
import { findSources } from '../../../library/index.js';
import { findNativeClass } from './find-native-classes.js';
import { findReactPackage } from './find-react-package.js';

interface Manifest {
  packages: string[];
  shared: string[];
}

/** What a generation provides, and what has to stay in the app's own loader. */
export function readManifest(directories: string[]): Manifest {
  const packages: string[] = [];
  const shared: string[] = [];

  for (const file of findSources(directories, ['.kt', '.java'])) {
    const source = readFileSync(file, 'utf8');

    const provided = findReactPackage(source);
    if (provided) packages.push(provided);

    const native = findNativeClass(source);
    if (native) shared.push(native);
  }

  return { packages, shared };
}
