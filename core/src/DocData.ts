import { MMTFile } from './CommonData';

export interface DocService {
  name?: string;
  sources?: string[]; // unified list of file/folder paths
}

export interface DocData extends MMTFile {
  title?: string;
  description?: string;
  sources?: string[]; // unified list of file/folder paths
  services?: DocService[];
}
