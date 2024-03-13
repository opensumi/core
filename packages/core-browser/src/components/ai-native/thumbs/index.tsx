import React, { useCallback, useMemo, useState } from 'react';

import { localize, uuid } from '@opensumi/ide-core-common';

import { IAIInlineChatService } from '../../../ai-native';
import { Popover } from '../../../components';
import { useInjectable } from '../../../react-hooks';
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

      if (type === 'down' && thumbsdownIcon === 'thumbsdown') {
        setThumbsdownIcon('thumbsdown-fill');
        setThumbsupIcon(false);
        report(false);
      }
    },
    [thumbsupIcon, thumbsdownIcon],
  );

  const useUUID = useMemo(() => uuid(6), []);

  return (
    <>
      {typeof thumbsupIcon === 'string' && (
        <Popover id={`ai-chat-thumbsup-${useUUID}`} title={localize('aiNative.inline.chat.operate.thumbsup.title')}>
          <EnhanceIcon
            wrapperClassName={wrapperClassName}
            onClick={() => handleClick('up')}
            className={getExternalIcon(thumbsupIcon, KTICON_OWNER)}
          />
        </Popover>
      )}
      {typeof thumbsdownIcon === 'string' && (
        <Popover id={`ai-chat-thumbsdown-${useUUID}`} title={localize('aiNative.inline.chat.operate.thumbsdown.title')}>
          <EnhanceIcon
            wrapperClassName={wrapperClassName}
            onClick={() => handleClick('down')}
            className={getExternalIcon(thumbsdownIcon, KTICON_OWNER)}
          />
        </Popover>
      )}
    </>
  );
};
