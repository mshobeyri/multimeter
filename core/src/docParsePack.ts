import {DocData, DocHtmlOptions, DocService} from './DocData';
import parseYaml, {packYaml} from './markupConvertor';
import {isNonEmptyList} from './safer';

export function yamlToDoc(yamlContent: string): DocData {
  try {
    const doc = parseYaml(yamlContent) as any;
    if (!doc || typeof doc !== 'object') {
      return {type: 'doc'} as DocData;
    }
    const sources: string[] = [];
    if (Array.isArray(doc.sources)) {
      sources.push(...doc.sources);
    }

    const services: DocService[]|undefined = Array.isArray(doc.services) ?
        doc.services.map((s: any) => {
          const svcSources: string[] = [];
          if (Array.isArray(s?.sources)) {
            svcSources.push(...s.sources);
          }
          return {
            name: s?.name,
            description: s?.description,
            sources: svcSources
          };
        }) :
        undefined;

    const res: DocData = {type: 'doc'};
    if (doc.title) {
      res.title = doc.title;
    }
    if (doc.description) {
      res.description = doc.description;
    }
    if (doc.logo) {
      res.logo = String(doc.logo);
    }
    if (sources.length) {
      res.sources = sources;
    }
    if (services && services.length) {
      res.services = services;
    }
    if (doc.html && typeof doc.html === 'object') {
      const htmlOpts: DocHtmlOptions = {};
      if (doc.html.triable !== undefined) {
        htmlOpts.triable = !!doc.html.triable;
      }
      if (doc.html.cors_proxy && typeof doc.html.cors_proxy === 'string') {
        htmlOpts.cors_proxy = doc.html.cors_proxy;
      }
      if (Object.keys(htmlOpts).length) {
        res.html = htmlOpts;
      }
    }
    if (doc.env && typeof doc.env === 'object' && !Array.isArray(doc.env)) {
      const envMap: Record<string, string> = {};
      for (const [k, v] of Object.entries(doc.env)) {
        envMap[k] = String(v);
      }
      if (Object.keys(envMap).length) {
        res.env = envMap;
      }
    }
    return res;
  } catch {
    return {type: 'doc'} as DocData;
  }
}

export function docToYaml(data: DocData): string {
  const out: any = {type: 'doc'};
  if (data.title) {
    out.title = data.title;
  }
  if (data.description) {
    out.description = data.description;
  }
  if (data.logo) {
    out.logo = data.logo;
  }
  if (isNonEmptyList(data.sources)) {
    out.sources = data.sources;
  }
  if (isNonEmptyList(data.services)) {
    out.services = data.services?.map(
        s => ({
          ...(s.name ? {name: s.name} : {}),
          ...(s.description ? {description: s.description} : {}),
          ...(isNonEmptyList(s.sources) ? {sources: s.sources} : {}),
        }));
  }
  if (data.html && typeof data.html === 'object') {
    const h: any = {};
    if (data.html.triable !== undefined) {
      h.triable = data.html.triable;
    }
    if (data.html.cors_proxy) {
      h.cors_proxy = data.html.cors_proxy;
    }
    if (Object.keys(h).length) {
      out.html = h;
    }
  }
  if (data.env && typeof data.env === 'object' && Object.keys(data.env).length) {
    out.env = { ...data.env };
  }
  return packYaml(out);
}

export default {yamlToDoc, docToYaml};
