import React, { useMemo } from 'react';

import { getExternalIcon, uuid } from '@opensumi/ide-core-browser';
import { Icon, Popover } from '@opensumi/ide-core-browser/lib/components';

import { EnhanceIcon } from './Icon';
import { LineVertical } from './lineVertical';

export const Thumbs = () => {
  const useUUID = useMemo(() => uuid(12), []);

  return (
    <>
      <Popover id={`ai-chat-thumbsup-${useUUID}`} title='赞'>
        <EnhanceIcon className={getExternalIcon('thumbsup')} />
      </Popover>
      <LineVertical marginRight={6} marginLeft={6} />
      <Popover id={`ai-chat-thumbsdown-${useUUID}`} title='踩'>
        <EnhanceIcon className={getExternalIcon('thumbsdown')} />
      </Popover>
    </>
  );
};
