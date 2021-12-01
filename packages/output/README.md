---
id: output
title: 输出模块
---

Output 模块用于管理 OpenSumi 内部以及来自插件的日志输出，对于模块来说，需要调用 outputService 的 `getChannel` 来获取/创建一个输出通道。这会在输出面板里新建一个输出通道用于展示该通道的日志。

```ts
@Injectable()
export class OutputDemo {
  @Autowired(OutputService)
  outputService: OutputService;

  private channel: OutputChannel | undefined;

  private initChannel() {
    this.channel = outputService.getChannel('Channel Name');
  }

  /*输出日志*/
  this.channel.append('some logging...');

  // 输出一行
  this.channel.appendLine('some logging...');
}

```

`OutputChannel` 是一个通道实例，默认情况下，创建的通道不会立即展示出来，可以调用 `channel.setVisibility(true)` 切换为激活的通道。

**为用户体验考虑建议非必要情况下，不要频繁调用该方法。**


### 配置项
Output 模块提供了两个核心配置项，用于控制输出内容的高亮以及自动滚动行为

- output.enableSmartScroll   配置是否开启智能滚动
- output.enableLogHighlight  配置是否开启 Log 高亮

#### 智能滚动
开启此配置后，每输出一行日志，输出通道将会自动滚动到底部，当鼠标点击某一行日志时会自动停止滚动，而若需要继续自动滚动，则需要将日志手动滚动到最后一行，并点击改行。这个行为参考了 VS Code 的输出。

#### 日志高亮
Output 模块的通道在 UI 层面实际实现是一个 Monaco Editor 实例，开启日志高亮则会将日志文本识别为 Log 语言，并依照内置的高亮规则来进行着色。

> 日志高亮需要额外安装 Log 语言插件

### 插件 API

插件中通过 `window.createOutputChannel` 也可以创建一个输出通道，该 API 底层即是通过 Output 模块实现的。

```ts
const channel = sumi.window.createOutputChannel('My Extension');

channel.appendLine('some logging...');
```

该 API 具有与 Output 模块类似的接口，例如可以调用 `channel.reveal` 将该通道激活，底层即是 `channel.setVisibility(true)`。


