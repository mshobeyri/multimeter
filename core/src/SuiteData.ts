export interface SuiteEnvironment {
  /** Preset name from multimeter.mmt (or `file` if specified) */
  preset?: string;
  /** Path to an env file to load (relative to suite or +/ project root) */
  file?: string;
  /** Inline key-value environment variables */
  variables?: Record<string, unknown>;
}

export interface SuiteData {
  type: 'suite';
  title?: string;
  description?: string;
  tags?: string[];
  servers?: string[];
  tests: Array<string>;
  /** Environment configuration (root-only) */
  environment?: SuiteEnvironment;
  /** Export file paths to generate after suite completion (root-only) */
  export?: string[];
}
