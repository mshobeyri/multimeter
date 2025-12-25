export interface SuiteData {
  type: 'suite';
  title?: string;
  description?: string;
  tags?: string[];
  tests: Array<string>;
}
