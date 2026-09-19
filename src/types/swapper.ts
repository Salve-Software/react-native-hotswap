export type Outcome = 'swapped' | 'failed' | 'needs-generation' | 'nothing-to-swap';

export interface Swapper {
  swap(path: string): Promise<Outcome>;
}

export type Platform = 'android' | 'ios';
