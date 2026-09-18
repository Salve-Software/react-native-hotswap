/** The file Xcode compiles a change into, and what to leave behind afterwards. */
export interface Patch {
  file: string;
  placeholder: string;
  contents: string;
}
