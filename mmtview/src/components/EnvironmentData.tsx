export type EnvironmentData = {
  type: string;
  variables: {
    [name: string]:
      | { [label: string]: string | undefined }
      | string[];
  };
  presets?: {
    [presetName: string]: {
      [envName: string]: {
        [variableName: string]: string;
      };
    };
  };
};