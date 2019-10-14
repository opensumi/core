import * as React from 'react';
import Anser from 'anser';
import { MessageType } from '@ali/ide-core-browser';

export interface AnsiConsoleItemProps {
  content: string;
  severity?: MessageType;
}

export const AnsiConsoleItem = ({
  content,
  severity,
}: React.PropsWithChildren<AnsiConsoleItemProps>) => {
  const htmlContent = Anser.ansiToHtml(content, {
    use_classes: true,
    remove_empty: true,
  });

  return <div className='theia-console-ansi-console-item' dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};
