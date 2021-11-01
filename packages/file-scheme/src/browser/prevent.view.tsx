import React from 'react';
import { IEventBus, localize, useInjectable } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ResourceOpenTypeChangedEvent } from '@ali/ide-editor/lib/browser/types';

import styles from './style.module.less';

export const LargeFilePrevent = () => {
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const eventBus = useInjectable<IEventBus>(IEventBus);

  const handleClick = () => {
    const current = editorService.currentResource;

    if (!current) {
      return;
    }

    current.metadata = { noPrevent: true };
    eventBus.fire(new ResourceOpenTypeChangedEvent(current.uri));
  };

  return (
    <div className={ styles.font }>
      { localize('editor.largeFile.prevent') }
      <a onClick={() => handleClick()}>{ localize('editor.largeFile.prevent.stillOpen') }</a>
    </div>
  );
};
