export interface CliRunResult {
  success: boolean;
  durationMs: number;
  errors: string[];
}

export interface NormalizedTest {
  raw: any;
  steps: any[];
  stages?: any[];
}
