import { IRPCProtocol } from '@opensumi/ide-connection';

import { IExtensionDescription } from '../../../common/vscode';
import { APIExtender } from '../common/extender';
import { ExtHostLanguages } from '../vscode/ext.host.language';

function createLanguageAPIFactory(extension: IExtensionDescription, extHostLanguages: ExtHostLanguages): any {
  return {
    getCurrentInlineCompletions() {
      return extHostLanguages.getCurrentInlineCompletions();
    },
  };
}

export function createLanguagesAPIExtender(
  extHostLanguages: ExtHostLanguages,
  rpcProtocol: IRPCProtocol,
): APIExtender<any> {
  return {
    extend(extension: IExtensionDescription, data: any) {
      let languages: any;

      if (data && data.languages) {
        languages = {
          ...data.languages,
          ...createLanguageAPIFactory(extension, extHostLanguages),
        };
      } else {
        languages = createLanguageAPIFactory(extension, extHostLanguages);
      }

      return {
        ...data,
        languages,
      };
    },
  };
}
