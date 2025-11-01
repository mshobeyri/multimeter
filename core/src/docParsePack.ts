import parseYaml, { packYaml } from './markupConvertor';
import { DocData, DocService } from './DocData';
import { isNonEmptyList } from './safer';

export function yamlToDoc(yamlContent: string): DocData {
	try {
		const doc = parseYaml(yamlContent) as any;
		if (!doc || typeof doc !== 'object') {
			return { type: 'doc' } as DocData;
		}
		// Back-compat: support legacy files/folders merged into sources
		const sources: string[] = [];
		if (Array.isArray(doc.sources)) { sources.push(...doc.sources); }
		if (Array.isArray(doc.files)) { sources.push(...doc.files); }
		if (Array.isArray(doc.folders)) { sources.push(...doc.folders); }

		const services: DocService[] | undefined = Array.isArray(doc.services)
			? doc.services.map((s: any) => {
					const svcSources: string[] = [];
					  if (Array.isArray(s?.sources)) { svcSources.push(...s.sources); }
					  if (Array.isArray(s?.files)) { svcSources.push(...s.files); }
					  if (Array.isArray(s?.folders)) { svcSources.push(...s.folders); }
					return { name: s?.name, sources: svcSources };
				})
			: undefined;

		const res: DocData = { type: 'doc' };
		if (doc.title) { res.title = doc.title; }
		if (doc.description) { res.description = doc.description; }
		if (sources.length) { res.sources = sources; }
		if (services && services.length) { res.services = services; }
		return res;
	} catch {
		return { type: 'doc' } as DocData;
	}
}

export function docToYaml(data: DocData): string {
	const out: any = { type: 'doc' };
		if (data.title) { out.title = data.title; }
		if (data.description) { out.description = data.description; }
		if (isNonEmptyList(data.sources)) { out.sources = data.sources; }
	if (isNonEmptyList(data.services)) {
		out.services = data.services?.map(s => ({
			...(s.name ? { name: s.name } : {}),
			...(isNonEmptyList(s.sources) ? { sources: s.sources } : {}),
		}));
	}
	return packYaml(out);
}

export default { yamlToDoc, docToYaml };

