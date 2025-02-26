import React from 'react';

import { Button } from '@opensumi/ide-components';
import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { IResource } from '@opensumi/ide-editor';

import { BaseApplyService } from '../../mcp/base-apply.service';

import styles from './inline-diff-widget.module.less';

export const InlineDiffManager: React.FC<{ resource: IResource }> = (props) => {
  const applyService = useInjectable<BaseApplyService>(BaseApplyService);
  return (
    <div className={styles.inlineDiffManager}>
      <Button
        onClick={() => {
          applyService.acceptAll(props.resource.uri);
        }}
      >
        {localize('ai.native.inlineDiff.acceptAll')}
      </Button>
      <Button
        type='ghost'
        onClick={() => {
          applyService.rejectAll(props.resource.uri);
        }}
      >
        {localize('ai.native.inlineDiff.rejectAll')}
      </Button>
    </div>
  );
};
