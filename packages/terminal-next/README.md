# 终端

## 实现方式

实现 src/common/term.ts 文件中的 ITerminalService 类型，并在 src/browser/index.ts 中替换默认的 service 类型。

```ts
export interface ITerminalService {
  /**
   * 集成方自定义会话唯一标识的函数
   */
  makeId(): string;
  /**
   * 集成方自定义写入到 localStorage 的键值的函数
   */
  restore(): string;
  /**
   * 当关闭 IDE 的时候，允许集成方额外向每一个会话标识写入一个字符串字段，
   * 信息内容由集成方决定
   *
   * @param sessionId 会话唯一标识
   */
  meta(sessionId: string): string;
  /**
   * Xterm 终端的构造选项
   */
  getOptions(): ITerminalOptions;
  /**
   * 用于获取特定会话的相关信息，包括进程 id 以及进程描述的 name，
   * 这个函数允许返回为空
   *
   * @param sessionId 会话唯一标识
   */
  intro(sessionId: string): { pid: number, name: string } | undefined;
  /**
   *
   * @param id 会话唯一标识
   * @param message 发送的字符串信息
   */
  sendText(id: string, message: string): Promise<void>;
  /**
   *
   * @param sessionId 会话唯一标识
   * @param term 返回的 Xterm 终端实例
   * @param restore 是否是恢复一个终端
   * @param meta 恢复终端所需要的额外字段
   * @param attachMethod 将 websocket 连接和 xterm 连接起来的函数
   * @param options 创建一个新终端的进程选项
   */
  attach(sessionId: string, term: Terminal, restore: boolean, meta: string, attachMethod: (s: WebSocket) => void, options?: TerminalOptions): Promise<void>;
  /**
   *
   * @param sessionId 会话唯一标识
   * @param cols resize 的列数
   * @param rows resize 的行数
   */
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
  /**
   * 销毁一个终端进程
   *
   * @param sessionId 会话唯一标识
   */
  disposeById(sessionId: string): void;
  /**
   * 异步向后端获取一个会话的进程 id
   *
   * @param sessionId 会话唯一标识
   */
  getProcessId(sessionId: string): Promise<number>;

  /**
   * 报错处理的事件
   *
   * @param handler
   */
  onError(handler: (error: ITerminalError) => void): void;
}
```

## 外部和内部 API

对于 common 中默认导出的 api 认为为外部 api，而对于 common 中没有默认导出的类型则认为为内部 api，内部 api 依然可以通过子名称获取到类型进行覆盖或者使用，但是内部 api 的任何 api 修改不作为 bk，不推荐直接使用内部 api。

## 接下来

* [ ] 终端首次初始化使用对比的外层 dom 节点需要可指定，这里可能需要使用 core 内部 api 手动计算
* [ ] 终端 Singleton 模式
* [ ] 终端后端 Pty 代码优化，需要支持开发时重连
* [ ] Vim 显示优化
