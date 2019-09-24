import * as React from 'react';
import { ansiToHtml } from 'anser';
import { MessageType } from '@ali/ide-core-browser';

export interface AnsiConsoleItemProps {
  content: string;
  severity?: MessageType;
}

export const AnsiConsoleItem = ({
  content,
  severity,
}: React.PropsWithChildren<AnsiConsoleItemProps>) => {
  const htmlContent = ansiToHtml(content, {
    use_classes: true,
    remove_empty: true,
  });

  return <div className='theia-console-ansi-console-item' dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};
