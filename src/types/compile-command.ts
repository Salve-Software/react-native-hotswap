/** One entry of the compile_commands.json the project's own build writes. */
export interface CompileCommand {
  directory: string;
  command: string;
  file: string;
}
