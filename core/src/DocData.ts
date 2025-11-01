import {MMTFile} from './CommonData';

export interface DocService {
  name?: string;
  description?: string;
  sources?: string[];  // unified list of file/folder paths
}

export interface DocData extends MMTFile {
  title?: string;
  description?: string;
  sources?: string[];  // unified list of file/folder paths
  services?: DocService[];
  theme?: {
    logo?: string;
    colors?: {
      fg?: string;
      bg?: string;
      muted?: string;
      accent?: string;
      card?: string;
      border?: string;
    }
  }
}
