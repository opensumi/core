---
id: overlay
title: 浮层模块
---

overlay 模块为 IDE 上的浮层模块，例如包含 Dialog（弹窗）、Message（消息）等模块。如果需要在 IDE 通知用户一条消息或者需要一个模态对话框和用户交互时，可以使用该模块。

## Message

Message 会在 IDE 右下角弹出一个提示信息。

![](https://gw-office.alipayobjects.com/bmw-prod/b9d110e1-73d5-41d7-aaad-14a4d630af13.png)

### 接口

```ts
export interface IMessageService {
  info(message: string | React.ReactNode, buttons?: string[], closable?: boolean): Promise<string | undefined>;
  warning(message: string | React.ReactNode, buttons?: string[], closable?: boolean): Promise<string | undefined>;
  error(message: string | React.ReactNode, buttons?: string[], closable?: boolean): Promise<string | undefined>;
  open<T = string>(message: string | React.ReactNode, type: MessageType, buttons?: string[], closable?: boolean, from?: string): Promise<T | undefined>;
  hide<T = string>(value?: T): void;
}
```

### 参数说明

以下参数以 info 为例

#### message
message 主要指定了消息体，可以是一个普通的文本消息，也可以是一个 React 组件

###### Example

```ts
import { IMessageService } from '@ide-framework/ide-overlay';

@Injectable()
export class MessageDemo {
  @Autowired(IMessageService)
  messageService: IMessageService;

  private showMessage() {
    this.messageService.info('复制成功');
  }
}

```

#### buttons
buttons 为弹窗右下角按钮，按照从左向右的顺序依次渲染，用户选择后会返回选择的结果

###### Example

```ts
import { IMessageService } from '@ide-framework/ide-overlay';

@Injectable()
export class MessageDemo {
  @Autowired(IMessageService)
  messageService: IMessageService;

  private async showMessage() {
    const res = await this.messageService.info('是否要更新插件', ['确定', '取消']);

    if (res === '确定') {
      //...
    }
  }
}

```


#### closable
是否显示关闭按钮，默认为 true

### 常见问题

#### 消息弹出时间是多久

- info: 15 秒
- warning: 18 秒
- error: 20 秒

#### 如何自定义消息组件

如果不想用默认消息图标，可以使用 `open` 接口自定义消息组件

##### Example

```tsx
export const CustomMessage = () => {
  const messageService = useInjectable(IMessageService)
  return (
    <div>
      <div>这是一个自定义消息</div>
      <button onClick={() => messageService.hide('确定')}>确定</button>
    </div>
  )
}
```

```ts
const res = await this.messageService.open(<CustomMessage />, MessageType.EMPTY);

if (res === '确定') {
  //...
}
```

## Dialog
Dialog 接口与消息一致，不过弹窗为模态

![](https://gw-office.alipayobjects.com/bmw-prod/6869e5f6-3e1a-452f-a562-02bab963b1b0.png)

### Example

```ts
import { IDialogService } from '@ide-framework/ide-overlay';

@Injectable()
export class MessageDemo {
  @Autowired(IDialogService)
  dialogService: IDialogService;

  private async showMessage() {
    const res = await this.dialogService.info('这是一个模态弹窗');

    if (res === '确定') {
      //...
    }
  }
}

```

