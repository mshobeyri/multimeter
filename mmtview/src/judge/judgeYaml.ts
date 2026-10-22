import { yamlToJudge, judgeToYaml } from 'mmt-core/parse/judgeParsePack';
import { JudgeData } from 'mmt-core/data/JudgeData';

export function patchJudgeYaml(
    content: string,
    patch: Partial<JudgeData> | ((judge: JudgeData) => JudgeData)): string {
  const judge = yamlToJudge(content);
  if (!judge) {
    return content;
  }
  const next = typeof patch === 'function' ? patch(judge) : { ...judge, ...patch };
  return judgeToYaml(next, content);
}
