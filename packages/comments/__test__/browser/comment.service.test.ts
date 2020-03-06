import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { CommentsModule } from '../../src/browser';
import { Injector } from '@ali/common-di';
import { ICommentsService, toRange, CommentMode } from '../../src/common';
import { URI } from '@ali/ide-core-common';
import { IContextKeyService } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IIconService } from '@ali/ide-theme';
import { IconService } from '@ali/ide-theme/lib/browser';

describe('comment service test', () => {
  let injector: MockInjector;
  let commentsService: ICommentsService;
  beforeAll(() => {
    (global as any).monaco = createMockedMonaco() as any;
    injector = createBrowserInjector([ CommentsModule ], new Injector([{
      token: IContextKeyService,
      useClass: MockContextKeyService,
    }, {
      token: IIconService,
      useClass: IconService,
    }]));
    commentsService = injector.get<ICommentsService>(ICommentsService);
  });

  afterAll(() => {
    (global as any).monaco = undefined;
  });

  it('create thread', () => {
    const uri = URI.file('/test');
    const [ thread ] = createTestThreads(uri);
    expect(thread.uri.isEqual(uri));
    expect(thread.range.startLineNumber).toBe(1);
    expect(thread.comments[0].body).toBe('评论内容1');
  });

  it('get commentsThreads', () => {
    const uri = URI.file('/test');
    const [ thread, thread2 ] = createTestThreads(uri);
    expect(commentsService.commentsThreads.length).toBe(2);
    // 按照创建时间排列
    expect(commentsService.commentsThreads[0]).toBe(thread);
    expect(commentsService.commentsThreads[1]).toBe(thread2);
  });

  it('getThreadByUri', () => {
    const uri = URI.file('/test');
    const [ thread, thread2 ] = createTestThreads(uri);
    const threads = commentsService.getThreadsByUri(uri);
    // 按照 range 升序排列
    expect(threads[0]).toBe(thread);
    expect(threads[1]).toBe(thread2);
  });

  it('commentsTreeNodes', () => {
    const uri = URI.file('/test');
    const [ thread, thread2 ] = createTestThreads(uri);
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
    expect(nodes[3].thread).toBe(thread2);
  });

  it('onThreadsCreated', () => {
    const threadsCreatedListener = jest.fn();
    commentsService.onThreadsCreated(threadsCreatedListener);
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, toRange(1), {
      comments: [{
        mode: CommentMode.Editor,
        author: {
          name: '蛋总',
        },
        body: '评论内容1',
      }],
    });
    expect(threadsCreatedListener.mock.calls.length).toBe(1);
    expect(threadsCreatedListener.mock.calls[0][0]).toBe(thread);
  });

  it('onThreadsChanged', () => {
    const threadsChangedListener = jest.fn();
    commentsService.onThreadsChanged(threadsChangedListener);
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, toRange(1), {
      comments: [{
        mode: CommentMode.Editor,
        author: {
          name: '蛋总',
        },
        body: '评论内容1',
      }],
    });
    thread.dispose();
    expect(threadsChangedListener.mock.calls.length).toBe(2);
  });

  function createTestThreads(uri: URI) {
    return [
      commentsService.createThread(uri, toRange(1), {
        comments: [{
          mode: CommentMode.Editor,
          author: {
            name: '蛋总',
          },
          body: '评论内容1',
        }],
      }),
      commentsService.createThread(uri, toRange(2), {
        comments: [{
          mode: CommentMode.Editor,
          author: {
            name: '蛋总',
          },
          body: '评论内容2',
        }],
      }),
    ];
  }
});
