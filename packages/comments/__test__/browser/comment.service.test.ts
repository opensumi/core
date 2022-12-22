import { Injector } from '@opensumi/di';
import {
  CommentContentNode,
  CommentFileNode,
  CommentRoot,
} from '@opensumi/ide-comments/lib/browser/tree/tree-node.defined';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { URI, positionToRange, Disposable } from '@opensumi/ide-core-common';
import { IEditor, EditorCollectionService, ResourceService } from '@opensumi/ide-editor';
import { IEditorDecorationCollectionService } from '@opensumi/ide-editor/lib/browser';
import { ResourceServiceImpl } from '@opensumi/ide-editor/lib/browser/resource.service';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector, mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { createMockedMonaco } from '../../../monaco/__mocks__/monaco';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { CommentsModule } from '../../src/browser';
import { ICommentsService, CommentMode } from '../../src/common';

describe('comment service test', () => {
  let injector: MockInjector;
  let commentsService: ICommentsService;
  let currentEditor: IEditor;
  beforeAll(() => {
    (global as any).monaco = createMockedMonaco() as any;
    const monacoEditor = mockService({
      getConfiguration: () => ({
        lineHeight: 20,
      }),
      onDidChangeConfiguration: () => Disposable.NULL,
      getLayoutInfo: () => ({
        minimapWidth: 10,
        minimapLeft: 10,
      }),
    });
    currentEditor = mockService({ monacoEditor });
    injector = createBrowserInjector(
      [CommentsModule],
      new Injector([
        {
          token: IContextKeyService,
          useClass: MockContextKeyService,
        },
        {
          token: IIconService,
          useClass: IconService,
        },
        {
          token: ResourceService,
          useClass: ResourceServiceImpl,
        },
        {
          token: EditorCollectionService,
          useValue: mockService({
            listEditors: () => [currentEditor],
          }),
        },
        {
          token: IEditorDecorationCollectionService,
          useValue: mockService({
            registerDecorationProvider: () => Disposable.NULL,
          }),
        },
      ]),
    );
  });

  beforeEach(() => {
    commentsService = injector.get<ICommentsService>(ICommentsService);
    commentsService.init();
  });

  afterEach(() => {
    commentsService.dispose();
  });

  afterAll(() => {
    (global as any).monaco = undefined;
  });

  it('create thread', () => {
    const uri = URI.file('/test');
    const [thread] = createTestThreads(uri);
    expect(thread.uri.isEqual(uri));
    expect(thread.range.startLineNumber).toBe(1);
    expect(thread.comments[0].body).toBe('评论内容1');
  });

  it('get commentsThreads', () => {
    const uri = URI.file('/test');
    const [thread, thread2] = createTestThreads(uri);
    expect(commentsService.commentsThreads.length).toBe(2);
    // 按照创建时间排列
    expect(commentsService.commentsThreads[0].id).toBe(thread.id);
    expect(commentsService.commentsThreads[1].id).toBe(thread2.id);
  });

  it('getThreadByUri', () => {
    const uri = URI.file('/test');
    const [thread, thread2] = createTestThreads(uri);
    const threads = commentsService.getThreadsByUri(uri);
    expect(threads.length).toBe(2);
    // 按照 range 升序排列
    expect(threads[0].id).toBe(thread.id);
    expect(threads[1].id).toBe(thread2.id);
  });

  it('resolveChildrens', async () => {
    const uri = URI.file('/test');
    const [thread] = createTestThreads(uri);
    thread.addComment({
      mode: CommentMode.Preview,
      author: {
        name: 'OpenSumi',
      },
      body: 'This is a reply',
    });
    const roots = await commentsService.resolveChildren();
    expect(roots?.length).toBe(1);
    if (!roots || roots.length < 1) {
      return;
    }
    const root = roots[0];
    expect(root).toBeDefined();
    const comments = await commentsService.resolveChildren(root as CommentRoot);
    expect(comments?.length).toBe(1);
    if (!comments || comments.length < 1) {
      return;
    }
    const comment = comments[0];
    expect(comment.displayName).toBe('test');
    expect((comment as CommentContentNode).description).toBe('test');
    const replys = await commentsService.resolveChildren(comment as CommentFileNode);
    if (!replys) {
      return;
    }
    const reply = replys[0];
    expect(reply).toBeDefined();
    expect(reply.displayName).toBeDefined();
  });

  it('onThreadsCreated', () => {
    const threadsCreatedListener = jest.fn();
    commentsService.onThreadsCreated(threadsCreatedListener);
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, positionToRange(1), {
      comments: [
        {
          mode: CommentMode.Editor,
          author: {
            name: 'User',
          },
          body: '评论内容1',
        },
      ],
    });
    expect(threadsCreatedListener.mock.calls.length).toBe(1);
    expect(threadsCreatedListener.mock.calls[0][0].id).toBe(thread.id);
  });

  it('onThreadsChanged', () => {
    const threadsChangedListener = jest.fn();
    commentsService.onThreadsChanged(threadsChangedListener);
    const uri = URI.file('/test');
    commentsService.createThread(uri, positionToRange(1), {
      comments: [
        {
          mode: CommentMode.Editor,
          author: {
            name: 'User',
          },
          body: '评论内容1',
        },
      ],
    });
    expect(threadsChangedListener.mock.calls.length).toBe(1);
  });

  it('unvisible widget not to be called with showWidgetsIfShowed method', async () => {
    const uri = URI.file('/test');
    const [thread] = createTestThreads(uri);
    currentEditor.currentUri = uri;
    // 生成一个 widget
    thread.show(currentEditor);
    // 调用隐藏方法，此时 isShow 为 false
    thread.hide();
    const widget = thread.getWidgetByEditor(currentEditor);
    expect(widget?.isShow).toBeFalsy();
    const onShow = jest.fn();
    widget?.onShow(onShow);
    thread.showWidgetsIfShowed();
    // 不会被调用 show 方法
    expect(onShow).not.toBeCalled();
    expect(widget?.isShow).toBeFalsy();
  });

  it('show widget when isShow is true', async () => {
    const uri = URI.file('/test');
    const [thread] = createTestThreads(uri);
    currentEditor.currentUri = uri;
    // 生成一个 widget
    thread.show(currentEditor);
    // 先通过 dispose 方式隐藏，此时 isShow 仍为 true
    thread.hideWidgetsByDispose();
    const widget = thread.getWidgetByEditor(currentEditor);
    expect(widget?.isShow).toBeTruthy();
    const onShow = jest.fn();
    widget?.onShow(onShow);
    thread.showWidgetsIfShowed();
    expect(onShow).toBeCalled();
  });

  it('dispose should not effect isShow state', async () => {
    const uri = URI.file('/test');
    const [thread] = createTestThreads(uri);
    currentEditor.currentUri = uri;
    // 生成一个 widget
    thread.show(currentEditor);
    const widget = thread.getWidgetByEditor(currentEditor);
    expect(widget?.isShow).toBeTruthy();
    thread.hideWidgetsByDispose();
    // 虽然隐藏了，但是 show 变量还是不变
    expect(widget?.isShow).toBeTruthy();
  });

  it('registerDecorationProvider to be recalled when register resource provider', () => {
    // @ts-ignore
    const $registerDecorationProvider = jest.spyOn(commentsService, 'registerDecorationProvider');
    const resourceProvider = injector.get<ResourceService>(ResourceService);
    resourceProvider.registerResourceProvider({
      scheme: 'pr',
      provideResource: () => mockService({}),
    });
    expect($registerDecorationProvider).toBeCalled();
  });

  function createTestThreads(uri: URI) {
    return [
      commentsService.createThread(uri, positionToRange(1), {
        comments: [
          {
            mode: CommentMode.Editor,
            author: {
              name: 'User',
            },
            body: '评论内容1',
          },
        ],
      }),
      commentsService.createThread(uri, positionToRange(2), {
        comments: [
          {
            mode: CommentMode.Editor,
            author: {
              name: 'User',
            },
            body: '评论内容2',
          },
        ],
      }),
    ];
  }
});
