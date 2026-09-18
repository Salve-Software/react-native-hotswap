export interface SwapConfig {
  root: string;
  port: number;
  iosPort: number;
  minApi: number;
  buildTools: string | undefined;
  abi: string;
  watch: string[];
  project: string;
  task: string;
  classes: string;
  workspace: string | undefined;
  scheme: string | undefined;
  derivedData: string | undefined;
  patchDir: string;
  arch: string;
  iosTarget: string;
  specs: string;
  generated: string;
}

export type SwapOverrides = Partial<SwapConfig>;
