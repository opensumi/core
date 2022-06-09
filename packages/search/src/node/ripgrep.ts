import { Injectable, Autowired } from '@opensumi/di';
import { path } from '@opensumi/ide-core-common';
import { IProcess, IProcessFactory, ProcessOptions } from '@opensumi/ide-process';
import { rgPath as _rgPath } from '@opensumi/ripgrep';

const { replaceAsarInPath } = path;

export const rgPath = replaceAsarInPath(_rgPath);

@Injectable()
export class RipGrepBinding {
  @Autowired(IProcessFactory)
  protected processFactory: IProcessFactory;

  doSpawn(args: string[], options?: Record<string, unknown>) {
    const processOptions: ProcessOptions = {
      command: rgPath,
      args,
      options,
    };

    const rgProcess: IProcess = this.processFactory.create(processOptions);
    return rgProcess;
  }
}
