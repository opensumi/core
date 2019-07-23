import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadStorage, KeysToAnyValues } from '../../common';
import { Injectable, Autowired } from '@ali/common-di';

@Injectable()
export class MainThreadStorage implements IMainThreadStorage {
  async $set(key: string, value: KeysToAnyValues, isGlobal: boolean) {
    return true;
  }
}
