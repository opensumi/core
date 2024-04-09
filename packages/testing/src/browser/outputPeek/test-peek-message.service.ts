import { Injectable } from '@opensumi/di';
import { Disposable, Emitter } from '@opensumi/ide-core-common';

import { ITestingPeekMessageService } from '../../common';

import { TestDto } from './test-output-peek';

@Injectable()
export class TestingPeekMessageServiceImpl extends Disposable implements ITestingPeekMessageService {
  public readonly _didReveal = this.registerDispose(new Emitter<TestDto>());
  public readonly _visibilityChange = this.registerDispose(new Emitter<boolean>());

  public readonly onDidReveal = this._didReveal.event;
  public readonly onVisibilityChange = this._visibilityChange.event;
}
