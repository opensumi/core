import * as React from 'react';
import { localize, useInjectable } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { IWebviewService } from '@ali/ide-webview';

export const BinaryEditorComponent: ReactEditorComponent<null> = (props) => {
  const src: string = props.resource.uri.toString();

  return (<div>
    {localize('editor.cannotOpenBinary')}
  </div>);
};
