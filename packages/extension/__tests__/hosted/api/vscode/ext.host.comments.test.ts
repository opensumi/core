import type vscode from 'vscode';

import { Injector } from '@opensumi/di';
import { ICommentsService, ICommentsFeatureRegistry, CommentReactionClick } from '@opensumi/ide-comments';
import { CommentsFeatureRegistry } from '@opensumi/ide-comments/lib/browser/comments-feature.registry';
import { CommentsService } from '@opensumi/ide-comments/lib/browser/comments.service';
import { RPCProtocol } from '@opensumi/ide-connection';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { Uri, Emitter, Disposable, IEventBus, URI } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { MainthreadComments } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.comments';
import {
  MainThreadAPIIdentifier,
  IMainThreadComments,
  ExtHostAPIIdentifier,
} from '@opensumi/ide-extension/lib/common/vscode';
import * as types from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import {
  ExtHostComments,
  createCommentsApiFactory,
  ExtHostCommentThread,
} from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.comments';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { LayoutService } from '@opensumi/ide-main-layout/lib/browser/layout.service';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../../../monaco/__mocks__/monaco.context-key.service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('extension/__tests__/hosted/api/vscode/ext.host.comments.test.ts', () => {
  let injector: Injector;
  let vscodeComments: typeof vscode.comments;
  let extComments: ExtHostComments;
  let mainThreadComments: IMainThreadComments;
  const emitterExt = new Emitter<any>();
  const emitterMain = new Emitter<any>();
  const mockClientExt = {
    send: (msg) => emitterMain.fire(msg),
    onMessage: emitterExt.event,
  };
  const mockClientMain = {
    send: (msg) => emitterExt.fire(msg),
    onMessage: emitterMain.event,
  };
  const rpcProtocolExt = new RPCProtocol(mockClientExt);
  const rpcProtocolMain = new RPCProtocol(mockClientMain);

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: ICommentsService,
        useClass: CommentsService,
      },
      {
        token: ICommentsFeatureRegistry,
        useClass: CommentsFeatureRegistry,
      },
      {
        token: IMainLayoutService,
        useClass: LayoutService,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: WorkbenchEditorService,
        useClass: WorkbenchEditorServiceImpl,
      },
    );
    const extCommands = mockService({});
    const extDocument = mockService({});
    const mainCommands = mockService({
      registerArgumentProcessor: () => Disposable.NULL,
    });
    const extension = mockService({
      id: 'vscode.vim',
      extensionId: 'cloud-ide.vim',
      isBuiltin: false,
    });
    extComments = rpcProtocolMain.set(
      ExtHostAPIIdentifier.ExtHostComments,
      new ExtHostComments(rpcProtocolMain, extCommands, extDocument),
    );
    mainThreadComments = rpcProtocolExt.set(
      MainThreadAPIIdentifier.MainThreadComments,
      injector.get(MainthreadComments, [rpcProtocolExt, mainCommands]),
    );
    vscodeComments = createCommentsApiFactory(extension, extComments);
  });

  afterEach(() => {
    // 静态递增置为 0
    (ExtHostComments as any).handlePool = 0;
    (ExtHostCommentThread as any)._handlePool = 0;
    injector.disposeAll();
  });

  it('registerCommentController', async () => {
    const id = 'test_id';
    const label = 'test_label';
    const $registerCommentController = jest.spyOn(mainThreadComments, '$registerCommentController');
    const controller = vscodeComments.createCommentController(id, label);

    controller.commentingRangeProvider = {
      provideCommentingRanges(document) {
        return [];
      },
    };
    expect(controller.id).toBe(id);
    expect(controller.label).toBe(label);
    await 0;
    expect($registerCommentController).toBeCalledTimes(1);
  });

  it('createCommentThread', async () => {
    const id = 'test_id';
    const label = 'test_label';
    const body = 'test_body';
    const author = '蛋总';
    const $createCommentThread = jest.spyOn(mainThreadComments, '$createCommentThread');
    const controller = vscodeComments.createCommentController(id, label);

    const thread = controller.createCommentThread(Uri.file('test'), new types.Range(1, 1, 1, 1), [
      {
        body,
        author: {
          name: author,
        },
        mode: types.CommentMode.Preview,
      },
    ]);
    expect(thread.range.start.line).toBe(1);
    expect(thread.comments.length).toBe(1);
    expect(thread.comments[0].body).toBe(body);
    expect(thread.comments[0].author.name).toBe(author);
    expect(thread.comments[0].mode).toBe(types.CommentMode.Preview);
    await 0;
    expect($createCommentThread).toBeCalledTimes(1);
  });

  it('updateCommentThread', async () => {
    const id = 'test_id';
    const label = 'test_label';
    const body = 'test_body';
    const author = '蛋总';
    const $updateCommentThread = jest.spyOn(mainThreadComments, '$updateCommentThread');
    const controller = vscodeComments.createCommentController(id, label);

    const thread = controller.createCommentThread(Uri.file('test'), new types.Range(1, 1, 1, 1), [
      {
        body,
        author: {
          name: author,
        },
        mode: types.CommentMode.Preview,
      },
    ]);
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
    thread.comments = [
      {
        body: 'body2',
        author: {
          name: author,
        },
        mode: types.CommentMode.Preview,
      },
    ];
    expect($updateCommentThread).toBeCalledTimes(2);
  });

  it('comment options', async () => {
    const id = 'test_id';
    const label = 'test_label';
    const commentsFeatureRegistry: ICommentsFeatureRegistry = injector.get(ICommentsFeatureRegistry);
    const $updateCommentControllerFeatures = jest.spyOn(mainThreadComments, '$updateCommentControllerFeatures');
    const controller = vscodeComments.createCommentController(id, label);

    controller.options = {
      placeHolder: 'please comment from test',
    };

    await 0;
    expect($updateCommentControllerFeatures).toBeCalledTimes(1);
    expect(commentsFeatureRegistry.getProviderFeature(id)?.placeholder).toBe('please comment from test');
  });

  it('comment reactions', async (done) => {
    const id = 'test_id';
    const label = 'test_label';
    const body = 'test_body';
    const author = '蛋总';
    const reaction = {
      iconPath: Uri.file('test.png'),
      label: '点赞',
      count: 1,
      authorHasReacted: false,
    };
    const eventBus: IEventBus = injector.get(IEventBus);
    const $updateCommentControllerFeatures = jest.spyOn(mainThreadComments, '$updateCommentControllerFeatures');
    const controller = vscodeComments.createCommentController(id, label);

    controller.reactionHandler = async (comment, reaction) => {
      expect(comment.reactions).toHaveLength(1);
      expect(reaction.label).toBe('点赞');
      done();
    };

    const thread = controller.createCommentThread(Uri.file('test'), new types.Range(1, 1, 1, 1), [
      {
        body,
        author: {
          name: author,
        },
        mode: types.CommentMode.Preview,
      },
    ]);
    thread.collapsibleState = types.CommentThreadCollapsibleState.Collapsed;
    thread.contextValue = 'test';
    thread.label = 'test';
    thread.range = new types.Range(2, 1, 2, 1);
    thread.comments = [
      {
        body: 'body2',
        author: {
          name: author,
        },
        mode: types.CommentMode.Preview,
        reactions: [reaction],
      },
    ];
    // 修改属性会加 100ms 的 debounce
    await sleep(100);
    expect($updateCommentControllerFeatures).toBeCalled();
    const modelReaction = {
      ...reaction,
      iconPath: URI.parse(reaction.iconPath.toString()),
    };

    eventBus.fire(
      new CommentReactionClick({
        thread: mockService({
          data: {
            commentThreadHandle: 0,
          },
        }),
        comment: mockService({
          // 1 表示为第一个 comment
          id: 1,
          reactions: [modelReaction],
        }),
        reaction: modelReaction,
      }),
    );
  });

  it('comment canReply', async () => {
    const id = 'test_id';
    const label = 'test_label';
    const $updateCommentThread = jest.spyOn(mainThreadComments, '$updateCommentThread');
    const controller = vscodeComments.createCommentController(id, label);
    const thread = controller.createCommentThread(Uri.file('test'), new types.Range(1, 1, 1, 1), []);
    thread.canReply = false;
    // 修改属性会加 100ms 的 debounce
    await sleep(100);
    expect($updateCommentThread).toBeCalled();
    expect($updateCommentThread).toBeCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      { canReply: false, comments: [] },
    );
  });

  it('dispose', async () => {
    const id = 'test_id';
    const label = 'test_label';
    const $deleteCommentThread = jest.spyOn(mainThreadComments, '$deleteCommentThread');
    const controller = vscodeComments.createCommentController(id, label);

    controller.commentingRangeProvider = {
      provideCommentingRanges(document) {
        return [];
      },
    };

    controller.createCommentThread(Uri.file('test'), new types.Range(1, 1, 1, 1), [
      {
        body: 'body',
        author: {
          name: '蛋总',
        },
        mode: types.CommentMode.Preview,
      },
    ]);

    controller.dispose();
    await 0;
    expect($deleteCommentThread).toBeCalledTimes(1);
  });
});
