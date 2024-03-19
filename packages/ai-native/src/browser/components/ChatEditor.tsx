import capitalize from 'lodash/capitalize';
import React, { useCallback, useMemo, useState } from 'react';
import Highlight from 'react-highlight';

import { IClipboardService, getIcon, useInjectable, uuid } from '@opensumi/ide-core-browser';
import { Popover } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ChatFeatureRegistryToken, IAIReporter, localize, runWhenIdle } from '@opensumi/ide-core-common';
import { insertSnippetWithMonacoEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { MonacoCommandRegistry } from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';

import { ChatFeatureRegistry } from '../chat/chat.feature.registry';

import styles from './components.module.less';
import { highLightLanguageSupport } from './highLight';

import './highlightTheme.less';

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
    runWhenIdle(() => {
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
        <Popover id={`ai-chat-inser-${useUUID}`} title={localize('aiNative.chat.code.insert')}>
          <EnhanceIcon className={getIcon('insert')} onClick={() => handleInsert()} />
        </Popover>
        <Popover
          id={`ai-chat-copy-${useUUID}`}
          title={localize(isCoping ? 'aiNative.chat.code.copy.success' : 'aiNative.chat.code.copy')}
        >
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
  const chatFeatureRegistry = useInjectable<ChatFeatureRegistry>(ChatFeatureRegistryToken);
  const [tag, setTag] = useState<string>('');
  const [txt, setTxt] = useState<string>(text);

  React.useEffect(() => {
    const { value, nameWithSlash } = chatFeatureRegistry.parseSlashCommand(text);

    if (nameWithSlash) {
      setTag(nameWithSlash);
      setTxt(value);
      return;
    }
  }, [text, chatFeatureRegistry]);

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
