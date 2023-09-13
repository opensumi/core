import React from 'react';

import { Schemes, URI, useInjectable } from '@opensumi/ide-core-browser';
import { getSimpleEditorOptions, ICodeEditor } from '@opensumi/ide-editor';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/index';

const ChatEditor = ({ input, language }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const editorCollectionService = useInjectable<EditorCollectionService>(EditorCollectionService);
  const documentService = useInjectable<IEditorDocumentModelService>(IEditorDocumentModelService);

  const createEditor = async (container: HTMLElement): Promise<ICodeEditor> => {
    const codeEditor: ICodeEditor = await editorCollectionService.createCodeEditor(container!, {
      ...getSimpleEditorOptions(),
      lineHeight: 21,
      scrollbar: {
        horizontal: 'hidden',
        vertical: 'hidden',
        handleMouseWheel: false,
      },
      tabSize: 2,
      contentLeft: 8,
      contentWidth: 8,
      acceptSuggestionOnEnter: 'on',
      renderIndentGuides: false,
      readOnly: true,
      wordWrap: 'on',
      automaticLayout: true
    });

    const docModel = await documentService.createModelReference(
      new URI(`ai/chat/editor/`).withScheme(Schemes.walkThroughSnippet),
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
            ref.current!.style.height = codeEditor.monacoEditor.getContentHeight() + 'px';
          })
        }
      });
    }
  }, [ref.current]);

  return <div ref={ref}></div>;
};

export const CodeBlockWrapper = ({ text }) => {
  const renderText = (content) => {
    const regexInlineCode = /`([^`]+)`/g;
    const regexBlockCode = /```([^`]+)```/g;

    return content.split(regexBlockCode).map((block, index) => {
      if (index % 2 === 0) {
        // 文本内容
        return block.split(regexInlineCode).map((inline, index) => {
          if (index % 2 === 0) {
            // 非代码内容
            return inline;
          } else {
            // 用 <span> 包裹代码行
            return (
              <span className='code-inline' key={index}>
                {inline}
              </span>
            );
          }
        });
      } else {
        return (
          <div className='code-block'>
            <ChatEditor input={block} language={'java'}/>
          </div>
        );
      }
    });
  };

  return <div className='ai-chat-code-wrapper'>{renderText(text)}</div>;
};