import React, { useMemo, useCallback, useState } from 'react';

import {
  getExternalIcon,
  uuid,
  KTICON_OWNER,
  IAIReporter,
  useInjectable,
  IAiInlineChatService,
} from '@opensumi/ide-core-browser';
import { Popover } from '@opensumi/ide-core-browser/lib/components';

import { EnhanceIcon } from '../enhanceIcon';

interface ThumbsProps {
  wrapperClassName?: string;
  relationId?: string;
  aiReporterService?: IAIReporter;
  onClick?: (isLike?: boolean) => void;
}

export const Thumbs = (props: ThumbsProps) => {
  const aiInlineChatService = useInjectable<IAiInlineChatService>(IAiInlineChatService);
  const { relationId, aiReporterService, onClick, wrapperClassName } = props;

  const [thumbsupIcon, setThumbsupIcon] = useState<boolean | string>('thumbs');
  const [thumbsdownIcon, setThumbsdownIcon] = useState<boolean | string>('thumbsdown');

  const report = useCallback(
    (isLike: boolean) => {
      if (relationId && aiReporterService) {
        aiReporterService.end(relationId, { isLike });
      }
      if (onClick) {
        onClick(isLike);
      }
      if (aiInlineChatService) {
        aiInlineChatService.fireThumbsEvent(isLike);
      }
    },
    [relationId, aiReporterService, aiInlineChatService],
  );

  const handleClick = useCallback(
    (type: 'up' | 'down') => {
      // only click once
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
        <Popover id={`ai-chat-thumbsup-${useUUID}`} title='赞'>
          <EnhanceIcon
            wrapperClassName={wrapperClassName}
            onClick={() => handleClick('up')}
            className={getExternalIcon(thumbsupIcon, KTICON_OWNER)}
          />
        </Popover>
      )}
      {typeof thumbsdownIcon === 'string' && (
        <Popover id={`ai-chat-thumbsdown-${useUUID}`} title='踩'>
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
