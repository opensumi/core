import { Injectable } from '@opensumi/di';
import {
  IDisposable,
  IProgressOptions,
  IProgressNotificationOptions,
  IProgressWindowOptions,
  IProgressCompositeOptions,
  IProgress,
  IProgressStep,
} from '@opensumi/ide-core-common';

import { IProgressIndicator, IProgressService } from '../src/progress';

@Injectable()
export class MockProgressService implements IProgressService {
  registerProgressIndicator(location: string, indicator?: IProgressIndicator): IDisposable {
    return {
      dispose() {},
    };
  }
  getIndicator(location: string): IProgressIndicator | undefined {
    return;
  }
  async withProgress<R>(
    options: IProgressOptions | IProgressNotificationOptions | IProgressWindowOptions | IProgressCompositeOptions,
    task: (progress: IProgress<IProgressStep>) => Promise<R>,
    onDidCancel?: (choice?: number) => void,
  ): Promise<R> {
    return await task({
      report() {},
    });
  }
}
