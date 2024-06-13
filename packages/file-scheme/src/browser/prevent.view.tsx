import cls from 'classnames';
import React from 'react';

import { IEventBus, getExternalIcon, localize, useInjectable } from '@opensumi/ide-core-browser';
import { Button } from '@opensumi/ide-core-browser/lib/components';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { ResourceOpenTypeChangedEvent } from '@opensumi/ide-editor/lib/browser/types';

import styles from './style.module.less';

interface PreventComponentProps {
  description: string;

  actions: {
    label: string;
    onClick: () => void;
  }[];
}
export const PreventComponent: React.FC<PreventComponentProps> = (props: PreventComponentProps) => (
  <div className={styles['error-page']}>
    <div className={cls(styles.icon, getExternalIcon('warning'))}></div>
    <div className={styles['description']}>{props.description}</div>

    <div className={styles['actions-wrapper']}>
      {props.actions.map((action, index) => (
        <Button key={index} onClick={() => action.onClick()} className={styles['action-button']}>
          {action.label}
        </Button>
      ))}
    </div>
  </div>
);

export const LargeFilePrevent = () => {
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const eventBus = useInjectable<IEventBus>(IEventBus);

  const handleClick = () => {
    const current = editorService.currentResource;

    if (!current) {
      return;
    }

    current.metadata = { ...current.metadata, skipPreventTooLarge: true };
    eventBus.fire(new ResourceOpenTypeChangedEvent(current.uri));
  };

  return (
    <PreventComponent
      description={localize('editor.largeFile.prevent')}
      actions={[
        {
          label: localize('editor.file.prevent.stillOpen'),
          onClick: () => handleClick(),
        },
      ]}
    />
  );
};
