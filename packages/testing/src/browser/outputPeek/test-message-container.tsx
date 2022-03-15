import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { IOpenerService, useInjectable } from '@opensumi/ide-core-browser';
import { Disposable, IMarkdownString, Schemas, URI } from '@opensumi/ide-core-common';
import {
  EditorCollectionService,
  getSimpleEditorOptions,
  IDiffEditor,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/lib/browser';
import { Markdown } from '@opensumi/ide-markdown';
import { IDiffEditorOptions, IEditorOptions } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';

import { TestPeekMessageToken } from '../../common';
import { ITestErrorMessage } from '../../common/testCollection';
import styles from '../components/testing.module.less';

import { TestDto } from './test-output-peek';
import { TestingPeekMessageServiceImpl } from './test-peek-message.service';


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

const MarkdownContentProvider = (props: { dto: TestDto | undefined }) => {
  const openerService: IOpenerService = useInjectable(IOpenerService);

  const shadowRootRef = useRef<HTMLDivElement | null>(null);
  const [message, useMessage] = useState<string>('');
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  const handleLinkClick = (uri: URI) => {
    if (uri && uri.scheme === Schemas.command) {
      openerService.open(uri);
    }
  };

  React.useEffect(() => {
    if (shadowRootRef.current) {
      const { dto } = props;
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
    <div ref={shadowRootRef} className={styles.preview_markdown}>
      {shadowRoot && (
        <ShadowContent root={shadowRoot}>
          <Markdown content={message} onLinkClick={handleLinkClick}></Markdown>
        </ShadowContent>
      )}
    </div>
  );
};

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
  const testingPeekMessageService: TestingPeekMessageServiceImpl = useInjectable(TestPeekMessageToken);

  const [type, setType] = useState<EContainerType>();
  const [dto, setDto] = useState<TestDto>();

  useEffect(() => {
    const disposer: Disposable = new Disposable();

    disposer.addDispose(
      testingPeekMessageService.onDidReveal(async (dto: TestDto) => {
        setDto(dto);
        const message = getMessage(dto);
        if (dto.isDiffable) {
          setType(EContainerType.DIFF);
        } else if (!(dto.isDiffable || typeof message.message === 'string')) {
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
    <div className={styles.test_output_peek_message_container} style={{ height: '100%' }}>
      {type === EContainerType.DIFF ? (
        <DiffContentProvider dto={dto} />
      ) : type === EContainerType.MARKDOWN ? (
        <MarkdownContentProvider dto={dto} />
      ) : type === EContainerType.PLANTTEXT ? (
        getMessage(dto).message
      ) : null}
    </div>
  );
};
