import { Injectable } from '@ide-framework/common-di';

@Injectable()
export class MockFileSearch {
  async find(pattern: string, options) {
    return [''];
  }
}
