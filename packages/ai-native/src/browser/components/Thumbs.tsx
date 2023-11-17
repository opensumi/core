import React, { useMemo, useCallback, useState } from 'react';

import { getExternalIcon, uuid, KTICON_OWNER } from '@opensumi/ide-core-browser';
import { Popover } from '@opensumi/ide-core-browser/lib/components';

import { IAIReporter } from '../../common';

import { EnhanceIcon } from './Icon';

interface ThumbsProps {
  relationId?: string;
  aiReporterService?: IAIReporter;
}

export const Thumbs = (props: ThumbsProps) => {
  const { relationId, aiReporterService } = props;

  const [thumbsupIcon, setThumbsupIcon] = useState('thumbs');
  const [thumbsdownIcon, setThumbsdownIcon] = useState('thumbsdown');

  const report = useCallback((isLike: boolean) => {
    if (relationId && aiReporterService) {
      aiReporterService.end(relationId, { isLike });
    }
  }, [relationId, aiReporterService]);

  const handleClick = useCallback((type: 'up' | 'down') => {
    // only click once
    if (type === 'up' && thumbsupIcon === 'thumbs') {
      setThumbsupIcon('thumbs-fill');
      report(true);
    }

    if (type === 'down' && thumbsdownIcon === 'thumbsdown') {
      setThumbsdownIcon('thumbsdown-fill');
      report(false);
    }
  }, [ thumbsupIcon, thumbsdownIcon]);

  const useUUID = useMemo(() => uuid(6), []);

  return (
    <>
      <Popover id={`ai-chat-thumbsup-${useUUID}`} title='赞'>
        <EnhanceIcon onClick={() => handleClick('up')} className={getExternalIcon(thumbsupIcon, KTICON_OWNER)} />
      </Popover>
      <Popover id={`ai-chat-thumbsdown-${useUUID}`} title='踩'>
        <EnhanceIcon onClick={() => handleClick('down')} className={getExternalIcon(thumbsdownIcon, KTICON_OWNER)} />
      </Popover>
    </>
  );
};
