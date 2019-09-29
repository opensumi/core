import { Disposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { DebugEditor } from '../../common';

export enum TopStackType {
  exception,
  debugger,
}

// TODO： Breakpoint Input/Log/message 视图
@Injectable()
export class DebugBreakpointWidget extends Disposable {

  @Autowired(DebugEditor)
  editor: DebugEditor;

  constructor() {
    super();
  }

}
