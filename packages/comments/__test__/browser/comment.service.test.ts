import { Injector } from '@opensumi/di';
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

  it('commentsTreeNodes', () => {
    const uri = URI.file('/test');
    const [thread, thread2] = createTestThreads(uri);
    thread.addComment({
      mode: CommentMode.Preview,
      author: {
        name: '何幻',
      },
      body: '这是一条回复',
    });
    const nodes = commentsService.commentsTreeNodes;
    // 根节点，两个子节点
    expect(nodes.length).toBe(4);
    // 默认第一个为根节点
    expect(nodes[0].parent).toBeUndefined();
    // 默认根节点为第一个 thread
    expect(nodes[0].thread).toBe(thread);
    // 根节点名称为 url 名称
    expect(nodes[0].name).toBe('test');
    // 第一个节点名称为用户名
    expect(nodes[1].name).toBe('蛋总');
    // 第一个节点描述为评论内容
    expect(nodes[1].description).toBe('评论内容1');
    expect(nodes[1].thread).toBe(thread);
    // 第一个节点对应的评论是第一条评论
    expect(nodes[1].comment).toBe(thread.comments[0]);
    // 第二个节点为第一个 thread 第一条回复
    expect(nodes[2].name).toBe('何幻');
    expect(nodes[2].description).toBe('这是一条回复');
    expect(nodes[2].comment).toBe(thread.comments[1]);
    // 第二个节点的 parent 为第一个节点
    expect(nodes[2].parent?.comment).toBe(thread.comments[0]);
    // 第三个节点为第二个 thread
    expect(nodes[3].description).toBe('评论内容2');
    expect(nodes[3].thread.id).toBe(thread2.id);
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
            name: '蛋总',
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
            name: '蛋总',
          },
          body: '评论内容1',
        },
      ],
    });
    expect(threadsChangedListener.mock.calls.length).toBe(1);
  });

  it('调用 showWidgetsIfShowed 时已经被隐藏的 widget 不会被调用 show 方法', async () => {
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

  it('如果 isShow 为 true 才会调用 show 方法', async () => {
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

  it('通过 dispose 的方式隐藏 widget，不会影响 isShow', async () => {
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
              name: '蛋总',
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
              name: '蛋总',
            },
            body: '评论内容2',
          },
        ],
      }),
    ];
  }
});
