import * as React from 'react';
import { localize, useInjectable, isElectronRenderer } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import * as styles from './style.module.less';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';

export const BinaryEditorComponent: ReactEditorComponent<null> = (props) => {
  const src: string = props.resource.uri.toString();
  const electronUIService = useInjectable(IElectronMainUIService) as IElectronMainUIService;

  return (<div className={styles.external}>
    {localize('editor.cannotOpenBinary')}
    { isElectronRenderer() ? <a onClick={() => electronUIService.openItem(props.resource.uri.codeUri.fsPath) }>{localize('editor.openExternal')}</a> : null }
  </div>);
};
