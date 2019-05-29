import { ReactEditorComponent } from '../types';
import * as React from 'react';
import { localize } from '@ali/ide-core-browser';

export const BinaryEditorComponent: ReactEditorComponent<null> = (props) => {
  const src: string = props.resource.uri.toString();
  return (<div>
    {localize('editor.cannotOpenBinary')}
  </div>);
};
