import React, { useMemo } from 'react';

import { getExternalIcon, uuid } from '@opensumi/ide-core-browser';
import { Icon, Popover } from '@opensumi/ide-core-browser/lib/components';

import { LineVertical } from './lineVertical';

/**
 * 点赞和踩组件，目前先不显示
 */
export const Thumbs = () => {
  const useUUID = useMemo(() => uuid(12), []);

  return (
    <>
      <Popover id={`ai-chat-thumbsup-${useUUID}`} title='赞'>
        <Icon className={getExternalIcon('thumbsup')} />
      </Popover>
      <LineVertical />
      <Popover id={`ai-chat-thumbsdown-${useUUID}`} title='踩'>
        <Icon className={getExternalIcon('thumbsdown')} />
      </Popover>
    </>
  );
};
