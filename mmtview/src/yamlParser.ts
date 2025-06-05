import YAML from 'yaml';

function parseYaml(yamlString: string): any {
  try {
    return YAML.parse(yamlString);
  } catch (e) {
    console.error("Failed to parse YAML:", e);
    return null;
  }
}

export default parseYaml;