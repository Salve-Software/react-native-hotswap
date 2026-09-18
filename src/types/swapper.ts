/** What came of a swap, and what the caller should do about it. */
export type Outcome = 'swapped' | 'failed' | 'needs-generation';

/** Something that can replace one saved file inside a running app. */
export interface Swapper {
  swap(path: string): Promise<Outcome>;
}

/** The platforms a saved file can belong to. */
export type Platform = 'android' | 'ios';
