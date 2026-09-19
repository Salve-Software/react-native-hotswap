import { readFileSync } from 'node:fs';
import { findSources } from '../../../library/index.js';
import { findReactPackage } from './find-react-package.js';

/** The React packages a generation rebuilds the module from. */
export function readPackages(directories: string[]): string[] {
  const packages: string[] = [];

  for (const file of findSources(directories, ['.kt', '.java'])) {
    const provided = findReactPackage(readFileSync(file, 'utf8'));
    if (provided) packages.push(provided);
  }

  return packages;
}
