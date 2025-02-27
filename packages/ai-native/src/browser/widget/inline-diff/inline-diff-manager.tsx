import React, { useEffect, useState } from 'react';

import { Button } from '@opensumi/ide-components';
import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { IResource } from '@opensumi/ide-editor';

import { BaseApplyService } from '../../mcp/base-apply.service';

import styles from './inline-diff-widget.module.less';

export const InlineDiffManager: React.FC<{ resource: IResource }> = (props) => {
  const applyService = useInjectable<BaseApplyService>(BaseApplyService);
  const [show, setShow] = useState(true);
  useEffect(() => {
    applyService.onCodeBlockUpdate((codeBlock) => {
      setShow(codeBlock.status === 'pending');
    });
  }, []);
  return (
    <div className={styles.inlineDiffManager} style={{ display: show ? 'flex' : 'none' }}>
      <Button
        onClick={() => {
          applyService.processAll(props.resource.uri, 'accept');
        }}
      >
        {localize('aiNative.inlineDiff.acceptAll')}
      </Button>
      <Button
        type='ghost'
        onClick={() => {
          applyService.processAll(props.resource.uri, 'reject');
        }}
      >
        {localize('aiNative.inlineDiff.rejectAll')}
      </Button>
    </div>
  );
};
