import { Injectable } from '@opensumi/di';

import { IAiBackService } from '../common';

@Injectable()
export class AiBackService implements IAiBackService {
  async request<T>(): Promise<T> {
    return void 0 as T;
  }
  async requestStream<T>(): Promise<T> {
    return void 0 as T;
  }

  async requestCompletion<T>() {
    return void 0 as T;
  }
}
