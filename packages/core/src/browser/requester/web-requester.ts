import { Requester, Request } from '../../common';
import { ajax } from 'rxjs/ajax';
import { map } from 'rxjs/operators';

export class WebRequester extends Requester {
  async send<T>(request: Request): Promise<T> {
    return ajax.post(`/api`, request)
      .pipe(map((resp) => resp.response))
      .toPromise();
  }
}
