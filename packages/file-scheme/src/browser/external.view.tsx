import React from 'react';

import { INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { AppConfig, IEventBus, localize, useInjectable } from '@opensumi/ide-core-browser';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import {
  ReactEditorComponent,
  ResourceOpenTypeChangedEvent,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';

import { PreventComponent } from './prevent.view';

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

  const actions = [
    {
      label: localize('editor.file.prevent.stillOpen'),
      onClick: () => handleClick(),
    },
  ];

  if (appConfig.isElectronRenderer) {
    actions.push({
      label: localize('editor.openExternal'),
      onClick: () => injector.get(IElectronMainUIService).openPath(srcPath),
    });
  }

  return <PreventComponent description={localize('editor.cannotOpenBinary')} actions={actions} />;
};
