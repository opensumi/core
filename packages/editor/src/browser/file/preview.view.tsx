import { ReactEditorComponent } from '../types';
import * as React from 'react';

export const ImagePreview: ReactEditorComponent<null> = (props) => {
  const src: string = props.resource.uri.toString();
  return (<div>
    <img src={src}/>
  </div>);
};
