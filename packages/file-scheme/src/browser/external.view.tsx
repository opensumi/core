import React from 'react';

import { INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { AppConfig, IEventBus, localize, useInjectable } from '@opensumi/ide-core-browser';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import {
  ReactEditorComponent,
  ResourceOpenTypeChangedEvent,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';

import styles from './style.module.less';

export const BinaryEditorComponent: ReactEditorComponent<null> = (props) => {
  const srcPath = props.resource.uri.codeUri.fsPath;
  const injector: Injector = useInjectable(INJECTOR_TOKEN);
  const appConfig: AppConfig = useInjectable(AppConfig);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const eventBus = useInjectable<IEventBus>(IEventBus);

  const handleClick = () => {
    const current = editorService.currentResource;

    if (!current) {
      return;
    }

    current.metadata = { ...current.metadata, skipPreventBinary: true };
    eventBus.fire(new ResourceOpenTypeChangedEvent(current.uri));
  };

  return (
    <div className={styles.external}>
      {localize('editor.cannotOpenBinary')}
      <a onClick={() => handleClick()}>{localize('editor.file.prevent.stillOpen')}</a>

      {appConfig.isElectronRenderer ? (
        <a onClick={() => injector.get(IElectronMainUIService).openPath(srcPath)}>{localize('editor.openExternal')}</a>
      ) : null}
    </div>
  );
};
