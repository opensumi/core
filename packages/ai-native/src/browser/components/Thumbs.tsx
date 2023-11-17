import React, { useMemo, useCallback, useState } from 'react';

import { getExternalIcon, uuid, KTICON_OWNER } from '@opensumi/ide-core-browser';
import { Popover } from '@opensumi/ide-core-browser/lib/components';

import { IAIReporter } from '../../common';

import { EnhanceIcon } from './Icon';

interface ThumbsProps {
  relationId?: string;
  aiReporterService?: IAIReporter;
  onClick?: (isLike?: boolean) => void;
}

export const Thumbs = (props: ThumbsProps) => {
  const { relationId, aiReporterService, onClick } = props;

  const [thumbsupIcon, setThumbsupIcon] = useState<boolean | string>('thumbs');
  const [thumbsdownIcon, setThumbsdownIcon] = useState<boolean | string>('thumbsdown');

  const report = useCallback((isLike: boolean) => {
    if (relationId && aiReporterService) {
      aiReporterService.end(relationId, { isLike });
    }
    if (onClick) {
      onClick(isLike);
    }
  }, [relationId, aiReporterService]);

  const handleClick = useCallback((type: 'up' | 'down') => {
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
  }, [ thumbsupIcon, thumbsdownIcon]);

  const useUUID = useMemo(() => uuid(6), []);

  return (
    <>
      {
        typeof thumbsupIcon === 'string' && (
          <Popover id={`ai-chat-thumbsup-${useUUID}`} title='赞'>
            <EnhanceIcon onClick={() => handleClick('up')} className={getExternalIcon(thumbsupIcon, KTICON_OWNER)} />
          </Popover>
        )
      }
      {
        typeof thumbsdownIcon === 'string' && (
          <Popover id={`ai-chat-thumbsdown-${useUUID}`} title='踩'>
            <EnhanceIcon onClick={() => handleClick('down')} className={getExternalIcon(thumbsdownIcon, KTICON_OWNER)} />
          </Popover>
        )
      }
    </>
  );
};
