#!/usr/bin/env node
/**
 * Build a Postman Collection v2.1 that mirrors open-meteo root suite HTTP calls.
 * Chained geocode→forecast tests set collection vars from the geocode response.
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Multimeter project root (api/, test/, suite.mmt, multimeter.mmt). */
const root = path.resolve(__dirname, '../multimeter');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

/** Drop expect/require/check/assert/report — we only need import + call inputs. */
function stripAssertionBlocks(raw) {
  const lines = raw.split('\n');
  const out = [];
  let skipIndent = null;
  for (const line of lines) {
    if (skipIndent !== null) {
      const indent = line.match(/^(\s*)/)[1].length;
      if (line.trim() === '' || indent > skipIndent) {
        continue;
      }
      skipIndent = null;
    }
    const m = /^(\s*)(?:-\s+)?(expect|require|check|assert|report)\s*:/.exec(line);
    if (m) {
      skipIndent = m[1].length;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function loadYamlLoose(raw) {
  return YAML.parse(stripAssertionBlocks(raw));
}

function resolveToken(value, ctx) {
  if (value == null) {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const cities = ctx.cities;
  const mCity = /^\$\{cities\.(\w+)\.(\w+)\}$/.exec(value);
  if (mCity) {
    return cities[mCity[1]][mCity[2]];
  }
  if (value.startsWith('e:')) {
    const key = value.slice(2);
    if (key === 'timezone') {
      return ctx.env.timezone;
    }
    if (key.startsWith('city.')) {
      const field = key.slice(5);
      return ctx.env.city.berlin[field];
    }
    return ctx.env[key] ?? value;
  }
  return value;
}

function resolveUrl(api, ctx) {
  let url = String(api.url || '');
  url = url.replace(/<<e:(\w+)>>/g, (_, k) => ctx.env[k] ?? '');
  return url;
}

function buildQuery(api, inputs, ctx) {
  const q = api.query || {};
  const out = [];
  for (const [k, raw] of Object.entries(q)) {
    let v = raw;
    if (typeof v === 'string' && v.startsWith('i:')) {
      const name = v.slice(2);
      v = inputs[name];
    } else if (typeof v === 'string' && (v.startsWith('e:') || v.includes('<<e:'))) {
      v = resolveToken(v.replace(/^<<e:(\w+)>>$/, 'e:$1'), ctx);
      if (typeof raw === 'string' && raw.includes('<<e:')) {
        v = String(raw).replace(/<<e:(\w+)>>/g, (_, key) => ctx.env[key] ?? '');
      }
    }
    if (v === undefined || v === null) {
      continue;
    }
    out.push({key: k, value: String(v)});
  }
  return out;
}

function requestItem(name, api, inputs, ctx, opts = {}) {
  const url = resolveUrl(api, ctx);
  const query = buildQuery(api, inputs, ctx);
  const u = new URL(url);
  for (const {key, value} of query) {
    u.searchParams.set(key, value);
  }
  const item = {
    name,
    request: {
      method: String(api.method || 'get').toUpperCase(),
      header: [],
      url: {
        raw: u.toString(),
        protocol: u.protocol.replace(':', ''),
        host: u.hostname.split('.'),
        path: u.pathname.replace(/^\//, '').split('/'),
        query,
      },
    },
    event: [],
  };
  if (opts.testsScript) {
    item.event.push({
      listen: 'test',
      script: {type: 'text/javascript', exec: opts.testsScript.split('\n')},
    });
  }
  return item;
}

function loadApi(rel) {
  const p = path.join(root, 'api', rel.endsWith('.mmt') ? rel : `${rel}.mmt`);
  return loadYamlLoose(read(p));
}

function parseTest(filePath, ctx) {
  const doc = loadYamlLoose(read(filePath));
  const imports = doc.import || {};
  const steps = doc.steps || [];
  const items = [];
  const stepOut = {};

  for (const step of steps) {
    if (!step || !step.call) {
      continue;
    }
    const alias = step.call;
    const apiRel = imports[alias];
    if (!apiRel || typeof apiRel !== 'string') {
      continue;
    }
    const apiFile = apiRel.replace(/^\+\/api\//, '');
    const api = loadApi(apiFile);
    const rawInputs = step.inputs || {};
    const inputs = {};
    for (const [k, v] of Object.entries(rawInputs)) {
      if (typeof v === 'string' && /^\$\{(\w+)\.(\w+)\}$/.test(v)) {
        const [, id, field] = /^\$\{(\w+)\.(\w+)\}$/.exec(v);
        inputs[k] = stepOut[id]?.[field];
      } else {
        inputs[k] = resolveToken(v, ctx);
      }
    }

    const isGeocode = apiFile.includes('geocode');
    const name = `${path.basename(path.dirname(filePath))}/${path.basename(filePath, '.mmt')} · ${alias}`;
    if (isGeocode) {
      items.push(requestItem(name, api, inputs, ctx, {
        testsScript: [
          'pm.test("status 200", () => pm.response.to.have.status(200));',
          'const j = pm.response.json();',
          'const r = (j.results && j.results[0]) || {};',
          'pm.collectionVariables.set("chain_lat", String(r.latitude ?? ""));',
          'pm.collectionVariables.set("chain_lon", String(r.longitude ?? ""));',
        ].join('\n'),
      }));
      // Approximate for next-step resolution when generating static URLs:
      // use cities.json when name matches a known city, else leave placeholders filled later
      const cityName = String(inputs.name || '').toLowerCase();
      const city = ctx.cities[cityName];
      stepOut[step.id || alias] = city ?
        {latitude: city.latitude, longitude: city.longitude} :
        {latitude: '{{chain_lat}}', longitude: '{{chain_lon}}'};
    } else {
      // If lat/lon still placeholders from chain, use Postman vars in query
      const patchedInputs = {...inputs};
      let testsScript = 'pm.test("status 200", () => pm.response.to.have.status(200));';
      if (patchedInputs.latitude === '{{chain_lat}}' ||
          String(rawInputs.latitude || '').startsWith('${place.')) {
        patchedInputs.latitude = '{{chain_lat}}';
        patchedInputs.longitude = '{{chain_lon}}';
      }
      const item = requestItem(name, api, patchedInputs, ctx, {testsScript});
      // Fix query values that are still mustache
      if (item.request.url.query) {
        for (const q of item.request.url.query) {
          if (q.value === '{{chain_lat}}' || q.value === '{{chain_lon}}') {
            // keep mustache; rebuild raw
          }
        }
        const u = new URL(resolveUrl(api, ctx));
        for (const q of item.request.url.query) {
          u.searchParams.set(q.key, q.value);
        }
        // URL API encodes {{ }} — restore mustache
        item.request.url.raw = u.toString()
            .replace(/%7B%7B/g, '{{')
            .replace(/%7D%7D/g, '}}');
      }
      items.push(item);
      if (step.id) {
        stepOut[step.id] = {};
      }
    }
  }
  return items;
}

function listSuiteTests(suitePath) {
  const doc = loadYamlLoose(read(suitePath));
  const dir = path.dirname(suitePath);
  const files = [];
  for (const item of doc.items || []) {
    if (!item || item === 'then') {
      continue;
    }
    const rel = typeof item === 'string' ? item : item.file || item.path;
    if (!rel || !String(rel).endsWith('.mmt')) {
      continue;
    }
    files.push(path.join(dir, rel));
  }
  return files;
}

const envDoc = loadYamlLoose(read(path.join(root, 'multimeter.mmt')));
const env = {};
for (const [k, v] of Object.entries(envDoc.variables || {})) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    // choice map — keep nested; for city take berlin as unused default
    env[k] = v;
  } else {
    env[k] = v;
  }
}
const cities = JSON.parse(read(path.join(root, 'cities.json')));
const ctx = {env, cities};

const rootSuite = loadYamlLoose(read(path.join(root, 'suite.mmt')));
const folders = [];
let total = 0;

for (const area of rootSuite.items || []) {
  if (!area || area === 'then') {
    continue;
  }
  const suitePath = path.join(root, area);
  const areaName = path.basename(path.dirname(suitePath));
  const tests = listSuiteTests(suitePath);
  const folderItems = [];
  for (const testFile of tests) {
    folderItems.push(...parseTest(testFile, ctx));
  }
  total += folderItems.length;
  folders.push({name: areaName, item: folderItems});
}

const collection = {
  info: {
    name: 'Open-Meteo (mirror of Multimeter root suite)',
    description:
        'Generated Postman collection mirroring examples/real-projects/open-meteo-mmt/multimeter/suite.mmt HTTP calls. Status-200 checks only (not full Multimeter expects).',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    {key: 'chain_lat', value: ''},
    {key: 'chain_lon', value: ''},
  ],
  item: folders,
};

const outPath = path.join(__dirname, 'open-meteo.root-suite.postman_collection.json');
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`Folders: ${folders.length}, requests: ${total}`);
