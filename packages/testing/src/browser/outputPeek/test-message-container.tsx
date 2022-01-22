import { useInjectable } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';
import {
  EditorCollectionService,
  getSimpleEditorOptions,
  IDiffEditor,
  IEditorDocumentModelService,
  IMarkdownString,
} from '@opensumi/ide-editor/lib/browser';
import { IDiffEditorOptions, IEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { TestPeekMessageToken } from '../../common';
import { ITestErrorMessage } from '../../common/testCollection';
import { TestDto } from './test-output-peek';
import { TestingPeekMessageServiceImpl } from './test-peek-message.service';
import { Markdown } from '@opensumi/ide-markdown';

enum EContainerType {
  DIFF,
  PLANTTEXT,
  MARKDOWN,
}

const commonEditorOptions: IEditorOptions = {
  scrollBeyondLastLine: false,
  scrollbar: {
    verticalScrollbarSize: 14,
    horizontal: 'auto',
    useShadows: true,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    alwaysConsumeMouseWheel: false,
  },
  fixedOverflowWidgets: true,
  readOnly: true,
  minimap: {
    enabled: false,
  },
};

const diffEditorOptions: IDiffEditorOptions = {
  ...commonEditorOptions,
  enableSplitViewResizing: true,
  renderOverviewRuler: false,
  ignoreTrimWhitespace: false,
  renderSideBySide: true,
};

const getMessage = (dto?: TestDto) =>
  dto ? dto.messages[dto.messageIndex] : { message: '', actual: '', expected: '' };

const ShadowContent = ({ root, children }) => ReactDOM.createPortal(children, root);

const MarkdownContentProvider = React.memo((props: { dto: TestDto | undefined }) => {
  const { dto } = props;

  // const openerService: IOpenerService = useInjectable(IOpenerService);

  const shadowRootRef = useRef<HTMLDivElement | null>(null);
  const [message, useMessage] = useState<string>('');
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  React.useEffect(() => {
    if (shadowRootRef.current) {
      const shadowRootElement = shadowRootRef.current.attachShadow({ mode: 'open' });
      if (!shadowRoot) {
        setShadowRoot(shadowRootElement);
      }

      const mdStr = getMessage(dto).message;
      // 不处理 \t 制表符
      const message = mdStr ? (mdStr as IMarkdownString).value.replace(/\t/g, '') : '';
      useMessage(message);
    }
  }, []);

  return (
    <div ref={shadowRootRef} className={'preview-markdown'}>
      {shadowRoot && (
        <ShadowContent root={shadowRoot}>
          <Markdown content={message}></Markdown>
        </ShadowContent>
      )}
    </div>
  );
});

const DiffContentProvider = React.memo((props: { dto: TestDto | undefined }) => {
  const { dto } = props;
  const documentModelService: IEditorDocumentModelService = useInjectable(IEditorDocumentModelService);
  const editorCollectionService: EditorCollectionService = useInjectable(EditorCollectionService);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dto) {
      return;
    }
    let diffEditor: IDiffEditor;

    const { expectedUri, actualUri } = dto;
    Promise.all([
      documentModelService.createModelReference(expectedUri),
      documentModelService.createModelReference(actualUri),
    ]).then((data) => {
      const [original, modified] = data;
      const { actual, expected } = getMessage(dto) as ITestErrorMessage;

      diffEditor = editorCollectionService.createDiffEditor(editorRef.current!, {
        ...getSimpleEditorOptions(),
        ...diffEditorOptions,
      });

      const originalModel = original.instance.getMonacoModel();
      const modifiedModel = modified.instance.getMonacoModel();

      originalModel.setValue(expected!);
      modifiedModel.setValue(actual!);

      diffEditor.compare(original, modified);

      diffEditor.originalEditor.monacoEditor.setModel(originalModel);
      diffEditor.modifiedEditor.monacoEditor.setModel(modifiedModel);
    });

    return () => {
      if (diffEditor) {
        diffEditor.dispose();
      }
    };
  }, []);

  return <div ref={editorRef} style={{ height: 'inherit' }}></div>;
});

export const TestMessageContainer = () => {
  const disposer: Disposable = new Disposable();
  const testingPeekMessageService: TestingPeekMessageServiceImpl = useInjectable(TestPeekMessageToken);

  const [type, setType] = useState<EContainerType>();
  const [dto, setDto] = useState<TestDto>();

  useEffect(() => {
    disposer.addDispose(
      testingPeekMessageService.onDidReveal(async (dto: TestDto) => {
        setDto(dto);
        const message = getMessage(dto);
        console.log('testingPeekMessageService', dto);
        if (dto.isDiffable) {
          setType(EContainerType.DIFF);
        } else if (!(dto.isDiffable || typeof message.message === 'string')) {
          console.log('testingPeekMessageService', message.message.value);
          setType(EContainerType.MARKDOWN);
        } else {
          setType(EContainerType.PLANTTEXT);
        }
      }),
    );

    return () => {
      disposer.dispose();
    };
  }, []);

  return (
    <>
      {type === EContainerType.DIFF ? (
        <DiffContentProvider dto={dto} />
      ) : type === EContainerType.MARKDOWN ? (
        <MarkdownContentProvider dto={dto} />
      ) : (
        ''
      )}
    </>
  );
};
