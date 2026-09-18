/** Something that can replace one saved file inside a running app. */
export interface Swapper {
  swap(path: string): Promise<boolean>;
}

/** The platforms a saved file can belong to. */
export type Platform = 'android' | 'ios';
