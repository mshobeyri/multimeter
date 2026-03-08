export interface SuiteData {
  type: 'suite';
  title?: string;
  description?: string;
  tags?: string[];
  servers?: string[];
  tests: Array<string>;
}
