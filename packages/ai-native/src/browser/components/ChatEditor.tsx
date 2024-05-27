import capitalize from 'lodash/capitalize';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Highlight from 'react-highlight';

import { IClipboardService, Schemes, URI, getIcon, useInjectable, uuid } from '@opensumi/ide-core-browser';
import { Popover } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { IAIReporter } from '@opensumi/ide-core-common/lib/ai-native/reporter';
import { EditorCollectionService, ICodeEditor, getSimpleEditorOptions } from '@opensumi/ide-editor';
import { insertSnippetWithMonacoEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { IEditorDocumentModelService, ILanguageService } from '@opensumi/ide-editor/lib/browser/index';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';

import { InstructionEnum, highLightLanguageSupport } from '../../common/index';

import styles from './components.module.less';
import './highlightTheme.less';

const ChatEditor = ({ input, language }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const editorCollectionService = useInjectable<EditorCollectionService>(EditorCollectionService);
  const documentService = useInjectable<IEditorDocumentModelService>(IEditorDocumentModelService);
  const clipboardService = useInjectable<IClipboardService>(IClipboardService);
  const monacoCommandRegistry = useInjectable<MonacoCommandRegistry>(MonacoCommandRegistry);
  const languageService = useInjectable<ILanguageService>(ILanguageService);
  // 用于在复制代码的时候切换 popover 的标题
  const [isCoping, setIsCoping] = useState<boolean>(false);
  const [codeEditor, setCodeEditor] = useState<ICodeEditor | null>(null);
  // 这里暂时关闭
  // const textmateTokenizer = useInjectable<TextmateService>(TextmateService);

  const useUUID = useMemo(() => uuid(12), [ref, ref.current]);

  useEffect(() => {
    if (input && codeEditor) {
      codeEditor.monacoEditor.setValue(input);
    }
  }, [input, codeEditor]);

  const createEditor = async (container: HTMLElement): Promise<ICodeEditor> => {
    const codeEditor: ICodeEditor = editorCollectionService.createCodeEditor(container!, {
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
      new URI(`ai/chat/editor/${useUUID}`).withScheme(Schemes.walkThroughSnippet),
    );

    const model = docModel.instance.getMonacoModel();
    model.updateOptions({ tabSize: 2 });
    codeEditor.monacoEditor.setModel(model);

    if (language && languageService.getLanguage(language)) {
      codeEditor.monacoEditor.getModel()?.setLanguage(language);
    }

    return codeEditor;
  };

  React.useEffect(() => {
    if (ref && ref.current) {
      createEditor(ref.current!).then((codeEditor) => {
        if (codeEditor) {
          codeEditor.monacoEditor.setValue(input);
          requestAnimationFrame(() => {
            ref.current!.style.height = codeEditor.monacoEditor.getContentHeight() + 2 + 'px';
          });
          setCodeEditor(codeEditor);
        }
      });
    }

    return () => {
      if (codeEditor) {
        return codeEditor.dispose();
      }
    };
  }, [ref.current]);

  const handleCopy = useCallback(async () => {
    setIsCoping(true);
    await clipboardService.writeText(input);
    setTimeout(() => {
      setIsCoping(false);
    }, 1000);
  }, [clipboardService, input]);

  const handleInsert = useCallback(() => {
    const editor = monacoCommandRegistry.getActiveCodeEditor();
    if (editor) {
      const selection = editor.getSelection();
      if (selection) {
        insertSnippetWithMonacoEditor(editor, input, [selection], { undoStopBefore: false, undoStopAfter: false });
      }
    }
  }, [monacoCommandRegistry]);

  return (
    <div className={styles.monaco_wrapper}>
      <div className={styles.action_toolbar}>
        <Popover id={`ai-chat-inser-${useUUID}`} title='插入代码'>
          <EnhanceIcon className={getIcon('insert')} onClick={() => handleInsert()} />
        </Popover>
        <Popover id={`ai-chat-copy-${useUUID}`} title={isCoping ? '复制成功' : '复制代码'}>
          ·
          <EnhanceIcon className={getIcon('copy')} onClick={() => handleCopy()} />
        </Popover>
      </div>
      <div ref={ref} className={styles.editor}></div>
    </div>
  );
};

export const CodeEditorWithHighlight = ({ input, language, relationId }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const monacoCommandRegistry = useInjectable<MonacoCommandRegistry>(MonacoCommandRegistry);
  const clipboardService = useInjectable<IClipboardService>(IClipboardService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);

  const [isCoping, setIsCoping] = useState<boolean>(false);
  const useUUID = useMemo(() => uuid(12), [ref, ref.current]);

  const handleCopy = useCallback(async () => {
    setIsCoping(true);
    await clipboardService.writeText(input);
    aiReporter.end(relationId, { copy: true });
    setTimeout(() => {
      setIsCoping(false);
    }, 1000);
  }, [clipboardService, input, relationId]);

  const handleInsert = useCallback(() => {
    const editor = monacoCommandRegistry.getActiveCodeEditor();
    if (editor) {
      const selection = editor.getSelection();
      if (selection) {
        insertSnippetWithMonacoEditor(editor, input, [selection], { undoStopBefore: false, undoStopAfter: false });
        aiReporter.end(relationId, { insert: true });
      }
    }
  }, [monacoCommandRegistry]);

  return (
    <div className={styles.monaco_wrapper}>
      <div className={styles.action_toolbar}>
        <Popover id={`ai-chat-inser-${useUUID}`} title='插入代码'>
          <EnhanceIcon className={getIcon('insert')} onClick={() => handleInsert()} />
        </Popover>
        <Popover id={`ai-chat-copy-${useUUID}`} title={isCoping ? '复制成功' : '复制代码'}>
          <EnhanceIcon className={getIcon('copy')} onClick={() => handleCopy()} />
        </Popover>
      </div>
      <Highlight language={language} ref={ref} className={styles.editor}>
        {input}
      </Highlight>
    </div>
  );
};

const CodeBlock = ({
  content = '',
  relationId,
  renderText,
}: {
  content?: string;
  relationId: string;
  renderText?: (t: string) => React.ReactNode;
}) => {
  const rgInlineCode = /`([^`]+)`/g;
  const rgBlockCode = /```([^]+?)```/g;
  const rgBlockCodeBefore = /```([^]+)?/g;

  const renderCodeEditor = (content: string) => {
    const language = content.split('\n')[0].trim().toLowerCase();
    const heighLightLang = highLightLanguageSupport.find((lang) => lang === language) || 'plaintext';

    content = content.replace(/.*?\n/, '');
    content = content.trim();
    return (
      <div className={styles.code_block}>
        <div className={styles.code_language}>{capitalize(heighLightLang)}</div>
        <CodeEditorWithHighlight input={content} language={language} relationId={relationId} />
      </div>
    );
  };

  const render = useMemo(() => {
    const blocks = content.split(rgBlockCode);
    const renderedContent: (string | React.ReactNode)[] = [];

    blocks.map((block: string, index) => {
      if (index % 2 === 0) {
        block.split(rgInlineCode).map((text, index) => {
          if (index % 2 === 0) {
            if (text.includes('```')) {
              const cutchunk = text.split(rgBlockCodeBefore).filter(Boolean);
              if (cutchunk.length === 2) {
                renderedContent.push(cutchunk[0]);
                renderedContent.push(renderCodeEditor(cutchunk[1]));
                return;
              }
            }

            if (renderText) {
              renderedContent.push(renderText(text));
            } else {
              renderedContent.push(text);
            }
          } else {
            renderedContent.push(
              <span className={styles.code_inline} key={index}>
                {text}
              </span>,
            );
          }
        });
      } else {
        renderedContent.push(renderCodeEditor(block));
      }
    });

    return renderedContent;
  }, [content, renderText]);

  return <>{render}</>;
};

export const CodeBlockWrapper = ({
  text,
  renderText,
  relationId,
}: {
  text?: string;
  relationId: string;
  renderText?: (t: string) => React.ReactNode;
}) => (
  <div className={styles.ai_chat_code_wrapper}>
    <div className={styles.render_text}>
      <CodeBlock content={text} renderText={renderText} relationId={relationId} />
    </div>
  </div>
);

export const CodeBlockWrapperInput = ({
  text,
  relationId,
  agentId,
  command,
}: {
  text: string;
  relationId: string;
  agentId?: string;
  command?: string;
}) => {
  const [tag, setTag] = useState<string>('');
  const [txt, setTxt] = useState<string>(text);

  React.useEffect(() => {
    Object.values(InstructionEnum).find((str: string) => {
      if (txt.startsWith(str)) {
        setTag(str);
        setTxt(txt.slice(str.length));
        return;
      }
    });
  }, [text]);

  return (
    <div className={styles.ai_chat_code_wrapper}>
      <div className={styles.render_text}>
        {tag && (
          <div className={styles.tag_wrapper}>
            <span className={styles.tag}>{tag}</span>
          </div>
        )}
        {agentId && (
          <div className={styles.tag} style={{ marginRight: 4 }}>
            @{agentId}
          </div>
        )}
        {command && <div className={styles.tag}>/ {command}</div>}
        <CodeBlock content={txt} relationId={relationId} />
      </div>
    </div>
  );
};
