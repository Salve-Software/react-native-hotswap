/** The Gradle project React Native autolinking creates for an npm package. */
export function gradleProjectName(packageName: string): string {
  return packageName.replace(/@/g, '').replace(/\//g, '_');
}
