import { createMonacoEditorApi } from './editor';
import { createStaticServiceApi } from './services';
import { createMonacoLanguageApi } from './languages';

export const monaco = Object.freeze({
  editor: createMonacoEditorApi(),
  services: createStaticServiceApi(),
  languages: createMonacoLanguageApi(),
});
