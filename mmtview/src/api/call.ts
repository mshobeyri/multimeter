import {JSONRecord} from '../CommonData';
import {formatBody} from '../markupConvertor';
import {safeList} from '../safer';
import {replaceAllRefs} from '../variableReplacer';

import {APIData} from './APIData';
import {extractOutputs} from './outputExtractor';

const callAPI =
    (send: any, api: APIData, inputs: JSONRecord,
     envVars: JSONRecord): Promise<JSONRecord> => {
      return (async () => {
        const envParameters: JSONRecord =
            safeList(envVars).reduce((acc, envVar) => {
              acc[envVar.name] = envVar.value;
              return acc;
            }, {} as JSONRecord);

        let req =
            replaceAllRefs(api, api?.inputs ?? {}, inputs ?? {}, envParameters);

        req.body = formatBody(req.format || 'json', req.body || '');

        const res = await send(req);

        const extractRules = api.extract || {};
        const outputNames = Object.keys(extractRules);

        const extractedValues = extractOutputs(
            {
              type: res?.headers?.['Content-Type'] ||
                      res?.headers?.['content-type']?.includes('xml') ||
                      (res?.body && res.body.startsWith &&
                       res.body.startsWith('<')) ?
                  'xml' :
                  'json',
              body: res?.body,
              headers: res?.headers || {},
              cookies: res?.cookies || {}
            },
            extractRules);

        const finalOutputs: JSONRecord = {};
        outputNames.forEach(outputName => {
          if (outputName in extractedValues) {
            finalOutputs[outputName] = extractedValues[outputName];
          } else {
            finalOutputs[outputName] = '';
          }
        });
        return finalOutputs;
      })();
    };
