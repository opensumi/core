import { IPtyProcessProxy, ITerminalServiceClient } from '../common';

export const PtyProcessData = 'PtyProcessData';
export interface PtyProcessData {
  id: string;
  clientId: string;
  pty: IPtyProcessProxy;
}

export const TerminalClientData = 'TerminalClientData';
export interface TerminalClientData {
  clientId: string;
  client: ITerminalServiceClient;
}
