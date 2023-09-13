import React from 'react';

import { Schemes, URI, getExternalIcon, getIcon, useInjectable, uuid } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';
import { getSimpleEditorOptions, ICodeEditor } from '@opensumi/ide-editor';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/index';

import * as styles from './components.module.less';

const ChatEditor = ({ input, language }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const editorCollectionService = useInjectable<EditorCollectionService>(EditorCollectionService);
  const documentService = useInjectable<IEditorDocumentModelService>(IEditorDocumentModelService);

  const createEditor = async (container: HTMLElement): Promise<ICodeEditor> => {
    const codeEditor: ICodeEditor = await editorCollectionService.createCodeEditor(container!, {
      ...getSimpleEditorOptions(),
      readOnly: true,
      lineNumbers: 'off',
      selectOnLineNumbers: true,
      scrollBeyondLastLine: false,
      lineDecorationsWidth: 8,
      dragAndDrop: false,
      padding: { top: 8, bottom: 8 },
      mouseWheelZoom: false,
      scrollbar: {
        alwaysConsumeMouseWheel: false,
      },
      wordWrap: 'off',
      ariaLabel: 'Code block',
      automaticLayout: true,
    });

    const docModel = await documentService.createModelReference(
      new URI(`ai/chat/editor/${uuid(12)}`).withScheme(Schemes.walkThroughSnippet),
    );

    const model = docModel.instance.getMonacoModel();
    model.updateOptions({ tabSize: 2 });
    codeEditor.monacoEditor.setModel(model);
    codeEditor.monacoEditor.getModel()?.setMode(language);

    return codeEditor;
  };

  React.useEffect(() => {
    if (ref && ref.current) {
      createEditor(ref.current).then((codeEditor) => {
        if (codeEditor) {
          codeEditor.monacoEditor.setValue(input);
          requestAnimationFrame(() => {
            ref.current!.style.height = codeEditor.monacoEditor.getContentHeight() + 2 + 'px';
          });
        }
      });
    }
  }, [ref.current]);

  return (
    <div className={styles.monaco_wrapper}>
      <div className={styles.action_toolbar}>
        <Icon className={getIcon('openfile')} />
        <Icon className={getIcon('file-copy')} />
      </div>
      <div ref={ref} className={styles.editor}></div>
    </div>
  );
};

export const CodeBlockWrapper = ({ text }: { text: string }) => {
  const renderText = (content) => {
    const regexInlineCode = /`([^`]+)`/g;
    const regexBlockCode = /```([^`]+)```/g;

    return content.split(regexBlockCode).map((block: string, index) => {
      if (index % 2 === 0) {
        // 文本内容
        return block.split(regexInlineCode).map((inline, index) => {
          if (index % 2 === 0) {
            // 非代码内容
            return inline;
          } else {
            // 用 <span> 包裹代码行
            return (
              <span className={styles.code_inline} key={index}>
                {inline}
              </span>
            );
          }
        });
      } else {
        // 通常第一个换行前的字符就是 language，比如 ```typescript
        const language = block.split('\n')[0] || 'plaintext';

        // 并去掉第一个 \n 前面的字符
        block = block.replace(/.*?\n/, '');
        block = block.trim();

        return (
          <div className={styles.code_block}>
            <ChatEditor input={block} language={language} />
          </div>
        );
      }
    });
  };

  return <div className={styles.ai_chat_code_wrapper}>{renderText(text)}</div>;
};
