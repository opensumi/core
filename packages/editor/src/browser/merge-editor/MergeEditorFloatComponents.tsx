import React, { useCallback } from 'react';

import { Button } from '@opensumi/ide-components';
import { localize } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser';

import styles from '../editor.module.less';

export const MergeEditorFloatComponents = (_: React.HtmlHTMLAttributes<HTMLDivElement>) => {
  const handleOpenMergeEditor = useCallback(() => {
    // not implemented
  }, []);

  return (
    <div className={styles.merge_editor_float_container}>
      <Button size='large' onClick={handleOpenMergeEditor}>
        {localize('mergeEditor.open.in.editor')}
      </Button>
    </div>
  );
};
