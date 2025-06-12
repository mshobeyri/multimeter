import YAML from 'yaml';
import { js2xml } from 'xml-js'; // <-- Add this import

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

// Utility to convert body (which may be YAML object or string) to the selected format
function formatBody(format: string, body: string | object): string {
  if (body === null) {return "";}
  try {
    if (format === "json") {
      const obj = typeof body === "string" ? YAML.parse(body) : body;
      return JSON.stringify(obj, null, 2);
    }
    if (format === "xml") {
      // Convert YAML (string or object) to XML
      const obj = typeof body === "string" ? YAML.parse(body) : body;
      return js2xml(obj, { compact: true, spaces: 2 });
    }
    if (format === "protobuf") {
      return typeof body === "string" ? body : YAML.stringify(body);
    }
    return typeof body === "string" ? body : YAML.stringify(body);
  } catch {
    return typeof body === "string" ? body : String(body);
  }
}

export { parseYaml, packYaml, formatBody };
export default parseYaml;