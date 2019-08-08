import * as React from 'react';
import { localize, useInjectable } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { IWebviewService } from '@ali/ide-webview';

export const BinaryEditorComponent: ReactEditorComponent<null> = (props) => {
  const src: string = props.resource.uri.toString();

  let ref: HTMLDivElement | null = null;

  const webviewService: IWebviewService = useInjectable(IWebviewService);
  const webview = React.useMemo(() => webviewService.createPlainWebview(), []);
  webview.loadURL('http://taobao.com');

  React.useEffect(() => {
    if (ref) {
      webview.appendTo(ref);
    }
  });

  return (<div ref={(el) => { ref = el; }}>
    {localize('editor.cannotOpenBinary')}
  </div>);
};
