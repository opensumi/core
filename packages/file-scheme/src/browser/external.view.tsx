import * as React from 'react';
import { localize, useInjectable, isElectronRenderer } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import * as styles from './style.module.less';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { INJECTOR_TOKEN } from '@ali/common-di';

export const BinaryEditorComponent: ReactEditorComponent<null> = (props) => {
  const src: string = props.resource.uri.toString();
  const injector = useInjectable(INJECTOR_TOKEN);

  return (<div className={styles.external}>
    {localize('editor.cannotOpenBinary')}
    { isElectronRenderer() ? <a onClick={() => injector.get(IElectronMainUIService).openItem(props.resource.uri.codeUri.fsPath) }>{localize('editor.openExternal')}</a> : null }
  </div>);
};
