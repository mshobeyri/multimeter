import { MMTFile } from "mmt-core/CommonData";

export interface Variable {
  name: string;
  type: string;
  info?: string;
  default?: string;
  fields?: Record<string, string>;
}

export type Variables = Variable[];
export interface VariablesData extends MMTFile {
  variables: Variables
}