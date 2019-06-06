import {
  MonacoWorkspace as BaseMonacoWorkspace,
  ProtocolToMonacoConverter,
  MonacoToProtocolConverter,
} from 'monaco-languageclient';
import { Injectable, markInjectable, setParameters } from '@ali/common-di';

markInjectable(ProtocolToMonacoConverter);
setParameters(ProtocolToMonacoConverter, []);
markInjectable(MonacoToProtocolConverter);
setParameters(MonacoToProtocolConverter, []);

@Injectable()
export class MonacoWorkspace extends BaseMonacoWorkspace {
  constructor(
    public p2m: ProtocolToMonacoConverter,
    public m2p: MonacoToProtocolConverter,
  ) {
    super(p2m, m2p);
  }
}
