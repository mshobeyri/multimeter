import {MMTFile} from './CommonData';

export interface DocHtmlOptions {
  triable?: boolean;
  cors_proxy?: string;
}

export interface DocService {
  name?: string;
  description?: string;
  sources?: string[];
}

export interface DocData extends MMTFile {
  title?: string;
  description?: string;
  logo?: string;
  sources?: string[];
  services?: DocService[];
  html?: DocHtmlOptions;
  env?: Record<string, string>;
}
