import { Injectable } from '@opensumi/di';

import { ITerminalProcessService } from '../common';

@Injectable()
export class TerminalProcessServiceImpl implements ITerminalProcessService {
  public getEnv(): Promise<NodeJS.ProcessEnv> {
    return Promise.resolve(process.env);
  }
}
