import {MMTFile} from './CommonData';
import {Repeat, Timestr} from './TestData';
import {SuiteEnvironment} from './SuiteData';

export interface LoadTestData extends MMTFile {
  type: 'loadtest';
  title?: string;
  description?: string;
  tags?: string[];
  test: string;
  threads?: number;
  repeat: Repeat | Timestr | number;
  rampup?: Timestr;
  environment?: SuiteEnvironment;
  export?: string[];
}