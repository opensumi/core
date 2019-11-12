import * as React from 'react';
import { MessageType } from '@ali/ide-core-browser';
import Ansi from 'ansi-to-react';

export interface AnsiConsoleItemProps {
  content: string;
  severity?: MessageType;
}

export const AnsiConsoleItemView = ({
  content,
  severity,
}: React.PropsWithChildren<AnsiConsoleItemProps>) => {

  return <Ansi linkify={false}>{content}</Ansi>;
};
