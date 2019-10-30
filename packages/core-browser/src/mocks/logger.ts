import { Injectable } from '@ali/common-di';

@Injectable()
export class MockLoggerManageClient {
  getLogger() {
    return console;
  }
}
