
import { JSONValue } from "mmt-core/CommonData";

export type EnvironmentData = {
  type: string;
  variables: {
    [name: string]: | { [label: string]: string | undefined } | string[];
  };
  presets?: {
    [presetName: string]: {
      [envName: string]: {
        [variableName: string]: string;
      };
    };
  };
};

export interface EnvOption {
  label: string;
  value: JSONValue;
}

export interface EnvVariable {
  name: string;
  label: string;
  value: JSONValue;
  options: EnvOption[];
}