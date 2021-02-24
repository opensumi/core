import { ExtHostComments, createCommentsApiFactory } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.comments';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IMainThreadComments } from '@ali/ide-kaitian-extension/lib/common/vscode';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { Uri } from '@ali/ide-core-common';
import * as types from '@ali/ide-kaitian-extension/lib/common/vscode/ext-types';
import type * as vscode from 'vscode';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('kaitian-extension/__tests__/hosted/api/vscode/ext.host.comments.test.ts', () => {
  let vscodeComments: typeof vscode.comments;
  let extComments: ExtHostComments;
  let mainThreadComments: IMainThreadComments;
  const map = new Map();
  const rpcProtocol: IRPCProtocol = {
    getProxy: (key) => {
      return map.get(key);
    },
    set: (key, value) => {
      map.set(key, value);
      return value;
    },
    get: (r) => map.get(r),
  };

  beforeEach(() => {
    mainThreadComments = mockService({
      $createCommentThread: jest.fn(() => Promise.resolve()),
      $registerCommentController: jest.fn(() => Promise.resolve()),
      $updateCommentThread: jest.fn(() => Promise.resolve()),
      $deleteCommentThread: jest.fn(() => Promise.resolve()),
    });
    const extCommands = mockService({});
    const extDocument = mockService({});
    const extension = mockService({
      id: 'vscode.vim',
      extensionId: 'cloud-ide.vim',
      isBuiltin: false,
    });
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadComments, mainThreadComments);
    extComments = new ExtHostComments(rpcProtocol, extCommands, extDocument);
    vscodeComments = createCommentsApiFactory(extension, extComments);
  });

  it('registerCommentController', () => {
    const id = 'test_id';
    const label = 'test_label';
    const controller = vscodeComments.createCommentController(id, label);

    controller.commentingRangeProvider = {
      provideCommentingRanges(document) {
        return [];
      },
    };
    expect(controller.id).toBe(id);
    expect(controller.label).toBe(label);
    expect(mainThreadComments.$registerCommentController).toBeCalledTimes(1);
  });

  it('createCommentThread', () => {
    const id = 'test_id';
    const label = 'test_label';
    const body = 'test_body';
    const author = '蛋总';
    const controller = vscodeComments.createCommentController(id, label);

    const thread = controller.createCommentThread(Uri.file('test'),  new types.Range(1, 1, 1, 1), [{
      body,
      author: {
        name: author,
      },
      mode: types.CommentMode.Preview,
    }]);
    expect(thread.range.start.line).toBe(1);
    expect(thread.comments.length).toBe(1);
    expect(thread.comments[0].body).toBe(body);
    expect(thread.comments[0].author.name).toBe(author);
    expect(thread.comments[0].mode).toBe(types.CommentMode.Preview);
    expect(mainThreadComments.$createCommentThread).toBeCalledTimes(1);
  });

  it('updateCommentThread', async () => {
    const id = 'test_id';
    const label = 'test_label';
    const body = 'test_body';
    const author = '蛋总';
    const controller = vscodeComments.createCommentController(id, label);

    const thread = controller.createCommentThread(Uri.file('test'),  new types.Range(1, 1, 1, 1), [{
      body,
      author: {
        name: author,
      },
      mode: types.CommentMode.Preview,
    }]);
    thread.collapsibleState = types.CommentThreadCollapsibleState.Collapsed;
    thread.contextValue = 'test';
    thread.label = 'test';
    thread.range = new types.Range(2, 1, 2, 1);

    expect(thread.collapsibleState).toBe(types.CommentThreadCollapsibleState.Collapsed);
    expect(thread.contextValue).toBe('test');
    expect(thread.label).toBe('test');
    expect(thread.range.start.line).toBe(2);

    // 修改属性会加 100ms 的 debounce
    await sleep(100);

    thread.comments = [{
      body: 'body2',
      author: {
        name: author,
      },
      mode: types.CommentMode.Preview,
    }];

    expect(mainThreadComments.$updateCommentThread).toBeCalledTimes(1);
  });

  it('dispose', () => {
    const id = 'test_id';
    const label = 'test_label';
    const controller = vscodeComments.createCommentController(id, label);

    controller.commentingRangeProvider = {
      provideCommentingRanges(document) {
        return [];
      },
    };

    controller.createCommentThread(Uri.file('test'),  new types.Range(1, 1, 1, 1), [{
      body: 'body',
      author: {
        name: '蛋总',
      },
      mode: types.CommentMode.Preview,
    }]);

    controller.dispose();

    expect(mainThreadComments.$deleteCommentThread).toBeCalledTimes(1);
  });

});
