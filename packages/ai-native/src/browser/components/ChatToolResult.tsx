import React from 'react';

import { localize } from '@opensumi/ide-core-common/lib/localize';

import { CodeEditorWithHighlight } from './ChatEditor';
import styles from './ChatToolResult.module.less';

interface ResultContent {
  type: 'text' | 'image';
  text?: string;
  data?: string;
  mimeType?: string;
}

interface ChatToolResultProps {
  result: string;
  relationId?: string;
}

export const ChatToolResult: React.FC<ChatToolResultProps> = ({ result, relationId }) => {
  const parseResult = React.useCallback((resultStr: string): ResultContent[] => {
    try {
      const parsed = JSON.parse(resultStr);
      return parsed.content || [];
    } catch (error) {
      return [{ type: 'text', text: resultStr }];
    }
  }, []);

  const renderContent = React.useCallback(
    (content: ResultContent, index: number) => {
      switch (content.type) {
        case 'text':
          return content.text ? (
            <div key={`text-${index}`} className={styles.text_content}>
              <CodeEditorWithHighlight input={content.text} language={'text'} relationId={relationId || ''} />
            </div>
          ) : null;
        case 'image':
          return content.data ? (
            <div key={`image-${index}`} className={styles.image_content}>
              <img
                src={`data:${content.mimeType || 'image/png'};base64,${content.data}`}
                alt={localize('aiNative.chat.result.image')}
              />
            </div>
          ) : null;
        default:
          return null;
      }
    },
    [relationId],
  );

  const contents = React.useMemo(() => parseResult(result), [result, parseResult]);

  if (!contents.length) {
    return null;
  }

  return (
    <div className={styles.result_container}>{contents.map((content, index) => renderContent(content, index))}</div>
  );
};
