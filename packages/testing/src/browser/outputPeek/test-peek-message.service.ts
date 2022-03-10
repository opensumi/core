import { Injectable, Autowired } from '@opensumi/di';
import { Disposable, URI, Emitter } from '@opensumi/ide-core-common';

import { ITestingPeekMessageService } from '../../common';

import { TestDto } from './test-output-peek';

@Injectable()
export class TestingPeekMessageServiceImpl extends Disposable implements ITestingPeekMessageService {
  public readonly _didReveal = new Emitter<TestDto>();
  public readonly _visibilityChange = new Emitter<boolean>();

  public readonly onDidReveal = this._didReveal.event;
  public readonly onVisibilityChange = this._visibilityChange.event;
}
