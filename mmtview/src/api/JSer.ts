import {JSONRecord} from '../CommonData';
import {formatBody} from '../markupConvertor';
import {safeList} from '../safer';
import {replaceAllRefs} from '../variableReplacer';

import {APIData} from './APIData';
import {extractOutputs} from './outputExtractor';
export interface Context {
  api: APIData, inputs: JSONRecord, envVars: JSONRecord
}

const getConn = (url: string, protocol: string): any => {
  // TODO: Implement connection logic
};

export const toJSfunction = (ctx: Context): string => {
  // Prepare input parameter names
  const inputNames = Array.isArray(ctx.api.inputs)
    ? ctx.api.inputs.map((input: any) => input.name)
    : Object.keys(ctx.api.inputs ?? {});
  const inputParams = inputNames.join(', ');

  // Prepare output names
  const extractRules = ctx.api.extract || ctx.api.outputs || {};
  const outputNames = Object.keys(extractRules);

  // Prepare env variable names
  const envVarNames = Array.isArray(ctx.envVars)
    ? ctx.envVars.map((envVar: any) => envVar.name)
    : Object.keys(ctx.envVars ?? {});

  // Generate the function as a string
  return `
async function call(${inputParams}) {
  const envParameters = {${envVarNames.map(name => `${name}: (typeof ${name} !== 'undefined' ? ${name} : '')`).join(', ')}};

  const inputs = {${inputNames.map(name => `${name}: ${name}`).join(', ')}};

  let req = replaceAllRefs(api, api.inputs ?? {}, inputs, envParameters);
  req.body = formatBody(req.format || 'json', req.body || '');

  const conn = getConn(req.url, req.protocol);
  const res = await conn.send(req);

  const extractedValues = extractOutputs(
    {
      type: (res?.headers?.['Content-Type'] || res?.headers?.['content-type'] || '').includes('xml') ||
            (res?.body && res.body.startsWith && res.body.startsWith('<')) ? 'xml' : 'json',
      body: res?.body,
      headers: res?.headers || {},
      cookies: res?.cookies || {}
    },
    ${JSON.stringify(extractRules)}
  );

  // Build final outputs object
  const finalOutputs = {};
  ${outputNames.map(name => `finalOutputs["${name}"] = extractedValues["${name}"] ?? "";`).join('\n  ')}

  return finalOutputs;
}
`.trim();
};
