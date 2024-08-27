import { CodeEditorModule } from '@difizen/libro-code-editor';
import { ManaModule } from '@difizen/mana-app';

import { LibroE2EditorContribution } from './editor-contribution';
import { Keybindhandler } from './keybind-handler';
import {
  LibroE2EditorOptions,
  LibroOpensumiEditor,
  LibroOpensumiEditorFactory,
  LibroOpensumiEditorState,
} from './opensumi-editor';

import type { EditorState, IEditorOptions } from '@difizen/libro-code-editor';

export const LibroOpensumiEditorModule = ManaModule.create()
  .register(
    LibroE2EditorContribution,
    LibroOpensumiEditor,
    // LanguageSpecRegistry,
    // LibroLanguageSpecs,
    // LibroSQLRequestAPI,
    Keybindhandler,
    {
      token: LibroOpensumiEditorFactory,
      useFactory: (ctx) => (options: IEditorOptions, editorState: EditorState) => {
        const child = ctx.container.createChild();
        child.register({ token: LibroE2EditorOptions, useValue: options });
        child.register({
          token: LibroOpensumiEditorState,
          useValue: editorState,
        });
        return child.get(LibroOpensumiEditor);
      },
    },
  )
  // .contribution(LanguageSpecContribution)
  .dependOn(CodeEditorModule);
