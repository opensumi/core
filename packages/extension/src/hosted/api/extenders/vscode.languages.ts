import type { APIExtender } from '../common/extender';
import type { ExtHostLanguages } from '../vscode/ext.host.language';

function createLanguageAPIFactory(extHostLanguages: ExtHostLanguages): any {
  return {
    getCurrentInlineCompletions() {
      return extHostLanguages.getCurrentInlineCompletions();
    },
    getNativeInlineCompletions() {
      return extHostLanguages.getNativeInlineCompletions();
    },
  };
}

export function createLanguagesAPIExtender(extHostLanguages: ExtHostLanguages): APIExtender<any> {
  const _languages = createLanguageAPIFactory(extHostLanguages);
  return {
    extend(data: any) {
      let languages: any;

      if (data && data.languages) {
        languages = {
          ...data.languages,
          ..._languages,
        };
      } else {
        languages = _languages;
      }

      return {
        ...data,
        languages,
      };
    },
  };
}
