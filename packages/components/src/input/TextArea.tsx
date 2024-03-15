import React from 'react';

import { IInputBaseProps, Input } from './Input';

export const TextArea = React.forwardRef<HTMLTextAreaElement, IInputBaseProps<HTMLTextAreaElement>>((props, ref) => (
  // @ts-ignore
  <Input {...props} as='textarea' ref={ref} />
));

TextArea.displayName = 'OpenSumiTextArea';
