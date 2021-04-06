---
id: decoration
title: 文件 decoration 模块
---

FileDecoration 模块主要用来注册/管理/分发跟文件名相关 Decoration 服务

# Interface

## IDecorationData

Decoration 的详情

```ts
  interface IDecorationData {
    /**
     * 权重
     */
    readonly weight?: number;
    /**
     * Decoration 颜色
     */
    readonly color?: ColorIdentifier;
    /**
     * Decoration 字符
     */
    readonly letter?: string;
    /**
     * Decoration tooltip
     */
    readonly tooltip?: string;
    /**
     * Decoration 是否冒泡，类似文件的 Decoration 是否传给文件夹
     */
    readonly bubble?: boolean;
  }
```

# 类

## FileDecorationsService

`DI token: IDecorationsService`

提供基于文件名的修饰服务

### Property

#### `onDidChangeDecorations`

```ts
  readonly onDidChangeDecorations: Event<IResourceDecorationChangeEvent>;
```

针对文件名的 Decoration 变更事件进行事件分发

##### Example

```ts
  this.decorationsService.onDidChangeDecorations(() => {
    // some listener
  })
```

### Methods

#### `registerDecorationsProvider`

```ts
  registerDecorationsProvider(provider: IDecorationsProvider): IDisposable;
```

注册 DecorationsProvider

##### Example

```ts
  class SampleDecorationsProvider implements IDecorationsProvider {
    readonly label = 'sample';

    readonly onDidChangeEmitter: Emitter<Uri[]> = new Emitter();

    get onDidChange() {
      return this.onDidChangeEmitter.event;
    }

    provideDecorations(resource: Uri): IDecorationData | undefined {
      if (file.scheme !== 'file') {
        return undefined;
      }

      return {
        letter: '😸',
        color: 'cat.smileForeground',
        tooltip: localize('cat.smile'),
        weight: -1,
        bubble: false,
      } as IDecorationData;
    }
  }
```


#### `getDecoration`

```ts
  getDecoration(uri: Uri, includeChildren: boolean, overwrite?: IDecorationData): IDecoration | undefined;
```

获取 uri 的方式获取当前文件的 Decoration 结果，如果没有获取到则返回 undefined

##### Example

```ts
  this.decorationsService.getDecoration(uri, true);
```
