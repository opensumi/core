import { Injectable } from '@opensumi/di';

@Injectable()
export class MockFileSearch {
  async find(pattern: string, options) {
    return [''];
  }
}
