import { CodeEditorContribution, CodeEditorFactory, LanguageSpecRegistry } from '@difizen/libro-code-editor';
import { EditorStateFactory } from '@difizen/libro-jupyter/noeditor';
import { inject, singleton } from '@difizen/mana-app';

import { Injector } from '@opensumi/di';

import { OpensumiInjector } from '../../mana';

import {
  LibroOpensumiEditorFactory,
  OpensumiEditorState,
  libroOpensumiEditorDefaultConfig,
  stateFactory,
} from './opensumi-editor';

@singleton({ contrib: [CodeEditorContribution] })
export class LibroE2EditorContribution implements CodeEditorContribution {
  @inject(LanguageSpecRegistry)
  protected readonly languageSpecRegistry: LanguageSpecRegistry;

  factory: CodeEditorFactory;

  stateFactory: EditorStateFactory<OpensumiEditorState>;

  defaultConfig = libroOpensumiEditorDefaultConfig;

  constructor(
    @inject(LibroOpensumiEditorFactory)
    libroOpensumiEditorFactory: LibroOpensumiEditorFactory,
    @inject(OpensumiInjector) injector: Injector,
  ) {
    this.factory = libroOpensumiEditorFactory;
    this.stateFactory = stateFactory(injector);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canHandle(mime: string): number {
    const LIBRO_MONACO_WEIGHT = 51;
    // 代码编辑都使用opensumi编辑器
    return LIBRO_MONACO_WEIGHT + 1;
  }
}
