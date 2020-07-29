import { Injectable } from '@ali/common-di';

@Injectable()
export class MockFileSearch {
  async find(pattern: string, options) {
    return [''];
  }
}
