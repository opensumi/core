import { Injectable } from '@opensumi/common-di';

@Injectable()
export class MockFileSearch {
  async find(pattern: string, options) {
    return [''];
  }
}
