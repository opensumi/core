import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactDOMClient from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import {
  AppConfig,
  ConfigProvider,
  Disposable,
  Emitter,
  Event,
  MonacoService,
  useInjectable,
} from '@opensumi/ide-core-browser';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { IDiffEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import { IDocumentDiff } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/documentDiffProvider';
import { RangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';
import { ILanguageSelection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IEditorWorkerService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/editorWorker';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { ZoneWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import styles from './inline-diff-widget.module.less';

@Injectable({ multiple: true })
export class InlineDiffHandler extends Disposable {
  constructor(private readonly monacoEditor: ICodeEditor) {
    super();
  }

  private get editorWorkerService(): IEditorWorkerService {
    return StandaloneServices.get(IEditorWorkerService);
  }

  public async computeDiff(newMessage: string): Promise<void> {
    const model = this.monacoEditor.getModel();
    if (!model) {
      return;
    }

    const modelService = StandaloneServices.get(IModelService);
    const languageSelection: ILanguageSelection = { languageId: model.getLanguageId(), onDidChange: Event.None };

    const originalModel = modelService.createModel(
      `export class Person {
  name: string;
}

// 我是注释
const person: Person = {
  name: "John Doe",
  age: 30
};

function greet(person: Person) {
  console.log(\`Hello, \${person.name}!\`, 66666);
  // #Command#: du -sh *
  // #Description#: 查看当前文件夹下所有文件和子文件夹的大小
}

greet(person); // Output: "Hello, John Doe!"
`,
      languageSelection,
    );
    const modifiedModel = modelService.createModel(newMessage, languageSelection);

    const result = await this.editorWorkerService.computeDiff(
      originalModel.uri,
      modifiedModel.uri,
      {
        computeMoves: false,
        maxComputationTimeMs: Number.MAX_SAFE_INTEGER,
        ignoreTrimWhitespace: false,
      },
      'advanced',
    );

    // console.log('compute diff:>>>> result >>>>>>>>>>>> ', result)
    // console.log('compute diff:>>>> result text <<< modifiedModel value >>><<<', newMessage)
  }
}
