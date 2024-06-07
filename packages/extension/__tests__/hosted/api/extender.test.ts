import merge from 'lodash/merge';

import { APIExtender } from '@opensumi/ide-extension/lib/hosted/api/common/extender';

describe('API Extender', () => {
  it('can modify the API', () => {
    class Api1 {
      languages = {
        getLanguages() {
          return 'Languages';
        },
      };
    }

    class Api2 {
      worker = {
        getWorker() {
          return 'Worker';
        },
      };
    }

    class ExtendedApiFactory implements APIExtender<any> {
      extend(api): any {
        let newAPI = {};

        if ('languages' in api) {
          newAPI = merge(newAPI, api, {
            languages: {
              hello() {
                return 'Hello';
              },
            },
          });
        }
        if ('worker' in api) {
          newAPI = merge(newAPI, api, {
            worker: {
              world() {
                return 'World';
              },
            },
          });
        }
        return newAPI;
      }
    }

    const api1 = new Api1();
    const api2 = new Api2();

    const extendedApiFactory = new ExtendedApiFactory();

    const enhancedApi1 = extendedApiFactory.extend(api1);
    expect(enhancedApi1.languages.getLanguages()).toBe('Languages');
    expect(enhancedApi1.languages.hello()).toBe('Hello');

    const enhancedApi2 = extendedApiFactory.extend(api2);
    expect(enhancedApi2.worker.getWorker()).toBe('Worker');
    expect(enhancedApi2.worker.world()).toBe('World');

    // The original API should not be modified
    expect((api1.languages as any).hello).toBeUndefined();
  });
});
