import YAML from 'yaml';

function parseYaml(yamlString: string): any {
  try {
    return YAML.parse(yamlString);
  } catch (e) {
    console.error("Failed to parse YAML:", e);
    return null;
  }
}

function packYaml(obj: any): string {
  try {
    return YAML.stringify(obj, { lineWidth: -1 });
  } catch (e) {
    console.error("Failed to stringify YAML:", e);
    return "";
  }
}

export { parseYaml, packYaml };
export default parseYaml;