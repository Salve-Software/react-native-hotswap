import { describe, expect, it } from 'vitest';
import { gradleProjectName } from '../gradle-project-name.js';

describe('gradleProjectName', () => {
  it('leaves an unscoped package alone', () => {
    expect(gradleProjectName('react-native-hotswap')).toBe('react-native-hotswap');
  });

  it('flattens a scope the way autolinking does, since a slash is not a Gradle path', () => {
    expect(gradleProjectName('@salve-software/react-native-hotswap')).toBe(
      'salve-software_react-native-hotswap',
    );
  });
});
