// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/cancellation.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationTokenSource, CancellationToken } from '../src/cancellation';

describe('CancellationToken', () => {
  test('None', () => {
    expect(CancellationToken.None.isCancellationRequested).toBe(false);
    expect(typeof CancellationToken.None.onCancellationRequested).toBe('function');
  });

  test('cancel before token', (done) => {
    const source = new CancellationTokenSource();
    expect(source.token.isCancellationRequested).toBe(false);
    source.cancel();

    expect(source.token.isCancellationRequested).toBe(true);

    source.token.onCancellationRequested(function () {
      expect(true).toBeTruthy();
      done();
    });
  });

  test('cancel happens only once', () => {
    const source = new CancellationTokenSource();
    expect(source.token.isCancellationRequested).toBe(false);

    let cancelCount = 0;
    function onCancel() {
      cancelCount += 1;
    }

    source.token.onCancellationRequested(onCancel);

    source.cancel();
    source.cancel();

    expect(cancelCount).toBe(1);
  });

  test('cancel calls all listeners', () => {
    let count = 0;

    const source = new CancellationTokenSource();
    source.token.onCancellationRequested(function () {
      count += 1;
    });
    source.token.onCancellationRequested(function () {
      count += 1;
    });
    source.token.onCancellationRequested(function () {
      count += 1;
    });

    source.cancel();
    expect(count).toBe(3);
  });

  test('token stays the same', () => {
    let source = new CancellationTokenSource();
    let token = source.token;
    expect(token === source.token).toBeTruthy(); // doesn't change on get

    source.cancel();
    expect(token === source.token).toBeTruthy(); // doesn't change after cancel

    source.cancel();
    expect(token === source.token).toBeTruthy(); // doesn't change after 2nd cancel

    source = new CancellationTokenSource();
    source.cancel();
    token = source.token;
    expect(token === source.token).toBeTruthy(); // doesn't change on get
  });

  test('dispose calls no listeners', () => {
    let count = 0;

    const source = new CancellationTokenSource();
    source.token.onCancellationRequested(function () {
      count += 1;
    });

    source.dispose();
    source.cancel();
    expect(count).toBe(0);
  });

  test('parent cancels child', () => {
    const parent = new CancellationTokenSource();
    const child = new CancellationTokenSource(parent.token);

    let count = 0;
    child.token.onCancellationRequested(() => (count += 1));

    parent.cancel();

    expect(count).toBe(1);
    expect(child.token.isCancellationRequested).toBe(true);
    expect(parent.token.isCancellationRequested).toBe(true);
  });
});
