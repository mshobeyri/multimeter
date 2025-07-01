import { Type } from "../CommonData";

export interface Variable {
  name: string;
  type: string;
  info?: string;
  default?: string;
  fields?: Record<string, string>;
}

export type Variables = Variable[];
export interface VariablesData {
  type: Type;
  variables: Variables
}
