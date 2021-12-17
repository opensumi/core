import React from 'react';

export interface ITextAreaProps {
  value: string;
}

export const TextArea: React.FC<ITextAreaProps> = () => <textarea name='' id='' cols={30} rows={10}></textarea>;

TextArea.displayName = 'KTTextArea';
