import { Injectable } from '@ali/common-di';

@Injectable()
export class MockWorkspace {
  setMostRecentlyOpenedFile(uri: string) {
    // noop
  }
}
