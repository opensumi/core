import * as React from 'react';
import { localize } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';

export const BinaryEditorComponent: ReactEditorComponent<null> = (props) => {
  const src: string = props.resource.uri.toString();
  return (<div>
    {localize('editor.cannotOpenBinary')}
  </div>);
};
