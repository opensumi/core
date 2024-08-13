import React, { useCallback, useState } from 'react';

import { localize } from '@opensumi/ide-core-common';

import { IAIInlineChatService } from '../../../ai-native';
import { Popover } from '../../../components';
import { useInjectable, useUUID } from '../../../react-hooks';
import { KTICON_OWNER, getExternalIcon } from '../../../style/icon/icon';
import { EnhanceIcon } from '../enhanceIcon';

interface ThumbsProps {
  wrapperClassName?: string;
  relationId?: string;
  onClick?: (isLike?: boolean) => void;
}

export const Thumbs = (props: ThumbsProps) => {
  const aiInlineChatService = useInjectable<IAIInlineChatService>(IAIInlineChatService);
  const { relationId, onClick, wrapperClassName } = props;

  const [thumbsupIcon, setThumbsupIcon] = useState<boolean | string>('thumbs');
  const [thumbsdownIcon, setThumbsdownIcon] = useState<boolean | string>('thumbsdown');

  const report = useCallback(
    (isLike: boolean) => {
      if (onClick) {
        onClick(isLike);
      }
      if (aiInlineChatService) {
        aiInlineChatService.fireThumbsEvent(isLike);
      }
    },
    [relationId, aiInlineChatService],
  );

  const handleClick = useCallback(
    (type: 'up' | 'down') => {
      if (type === 'up' && thumbsupIcon === 'thumbs') {
        setThumbsupIcon('thumbs-fill');
        setThumbsdownIcon(false);
        report(true);
      }

      if (type === 'up' && thumbsupIcon === 'thumbs-fill') {
        setThumbsupIcon('thumbs');
        setThumbsdownIcon('thumbsdown');
      }

      if (type === 'down' && thumbsdownIcon === 'thumbsdown') {
        setThumbsdownIcon('thumbsdown-fill');
        setThumbsupIcon(false);
        report(false);
      }

      if (type === 'down' && thumbsdownIcon === 'thumbsdown-fill') {
        setThumbsdownIcon('thumbsdown');
        setThumbsupIcon('thumbs');
      }
    },
    [thumbsupIcon, thumbsdownIcon],
  );

  const id = useUUID();

  return (
    <>
      {typeof thumbsupIcon === 'string' && (
        <Popover id={`ai-chat-thumbsup-${id}`} title={localize('aiNative.inline.chat.operate.thumbsup.title')}>
          <EnhanceIcon
            wrapperClassName={wrapperClassName}
            onClick={() => handleClick('up')}
            className={getExternalIcon(thumbsupIcon, KTICON_OWNER)}
            tabIndex={0}
            role='button'
            ariaLabel={localize('aiNative.inline.chat.operate.thumbsup.title')}
            ariaPressed={thumbsupIcon === 'thumbs-fill' ? 'true' : 'false'}
          />
        </Popover>
      )}
      {typeof thumbsdownIcon === 'string' && (
        <Popover id={`ai-chat-thumbsdown-${id}`} title={localize('aiNative.inline.chat.operate.thumbsdown.title')}>
          <EnhanceIcon
            wrapperClassName={wrapperClassName}
            onClick={() => handleClick('down')}
            className={getExternalIcon(thumbsdownIcon, KTICON_OWNER)}
            tabIndex={0}
            role='button'
            ariaLabel={localize('aiNative.inline.chat.operate.thumbsdown.title')}
            ariaPressed={thumbsdownIcon === 'thumbsdown-fill' ? 'true' : 'false'}
          />
        </Popover>
      )}
    </>
  );
};
