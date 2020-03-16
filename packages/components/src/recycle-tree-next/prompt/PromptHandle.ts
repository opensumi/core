import { DisposablesComposite, IDisposable, Notificar } from './node_modules/notificar';
import { bindInputElement, IProxiedInputProps } from '../../components/ProxiedInput';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

enum PromptEvent {
  Change = 1,
  Commit,
  Cancel,
  Focus,
  Blur,
  Destroy,
}

/**
 * 输入输出框需要在外部手动进行管理，由于我们使用的是虚拟的react节点渲染，一旦用户向上或向下滚动超出渲染访问，相关的React组件会被回收
 * 故这里在外部手动维护输入框对象
 */
export abstract class PromptHandle {
  public readonly $: HTMLInputElement;
  public readonly ProxiedInput: (props: IProxiedInputProps) => JSX.Element;
  private events: Notificar<PromptEvent> = new Notificar();
  private disposables: DisposablesComposite = new DisposablesComposite();
  private isInPendingCommitState: boolean = false;
  private _destroyed: boolean = false;
  constructor() {
    this.$ = document.createElement('input');
    this.$.setAttribute('type', 'text');
    this.ProxiedInput = bindInputElement(this.$);
    this.$.addEventListener('click', this.handleClick);
    this.$.addEventListener('keyup', this.handleKeyup);
    this.$.addEventListener('keydown', this.handleKeydown);
    this.$.addEventListener('focus', this.handleFocus);
    this.$.addEventListener('blur', this.handleBlur);

    // 可能存在PromptHandle创建后没被使用的情况
  }

  abstract get id(): number

  abstract get depth(): number

  get destroyed() {
    return this._destroyed;
  }

  public onChange(callback: (value: string) => void): IDisposable {
    return this.disposables.add(
      this.events.add(PromptEvent.Change, callback));
  }

  public onCommit(callback: (value: string) => void): IDisposable {
    return this.disposables.add(
      this.events.add(PromptEvent.Commit, callback));
  }

  public onCancel(callback: (value: string) => void): IDisposable {
    return this.disposables.add(
      this.events.add(PromptEvent.Cancel, callback));
  }

  public onFocus(callback: (value: string) => void): IDisposable {
    return this.disposables.add(
      this.events.add(PromptEvent.Focus, callback));
  }

  public onBlur(callback: (value: string) => void): IDisposable {
    return this.disposables.add(
      this.events.add(PromptEvent.Blur, callback));
  }

  public onDestroy(callback: (value: string) => void): IDisposable {
    return this.disposables.add(
      this.events.add(PromptEvent.Destroy, callback));
  }

  public focus(): void {
    this.$.focus();
  }

  public setSelectionRange(start: number, end: number): void {
    this.$.setSelectionRange(start, end);
  }

  public addClassName(classname: string): void {
    this.$.classList.add(classname);
  }

  public removeClassName(classname: string): void {
    this.$.classList.remove(classname);
  }

  public destroy(): void {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this.$.removeEventListener('click', this.handleClick);
    this.$.removeEventListener('keyup', this.handleKeyup);
    this.$.removeEventListener('keydown', this.handleKeydown);
    this.$.removeEventListener('focus', this.handleFocus);
    this.$.removeEventListener('blur', this.handleBlur);
    this.$.disabled = false;
    this.events.dispatch(PromptEvent.Destroy);
    this.disposables.dispose();
  }

  private handleClick = (ev) => {
    ev.stopPropagation();
  }

  private handleKeyup = (ev) => {
    this.events.dispatch(PromptEvent.Change, this.$.value);
  }

  private handleKeydown = async (ev) => {
    if (ev.key === 'Escape') {
      if ((await Promise.all(
        this.events.dispatchWithReturn<boolean>(PromptEvent.Cancel, this.$.value))
      ).some((r) => r === false)) {
        return;
      }
      this.destroy();
    }

    if (ev.key === 'Enter') {
      this.isInPendingCommitState = true;
      this.$.disabled = true;
      if ((await Promise.all(
        this.events.dispatchWithReturn<boolean>(PromptEvent.Commit, this.$.value))
      ).some((r) => r === false)) {
        this.isInPendingCommitState = false;
        this.$.disabled = false;
        this.$.focus();
        return;
      }
      this.isInPendingCommitState = false;
      this.$.disabled = false;
      this.destroy();
    }
  }

  private handleFocus = () => {
    this.events.dispatch(PromptEvent.Focus, this.$.value);
  }

  private handleBlur = async (ev) => {
    // 如果Input由于`react-virtualized`被从视图中卸载，在下一帧前Input的isConnected属性不会被更新
    await delay(0);

    // 如果Input组件不在DOM中，但也没有被手动销毁，则表示由于其不在视窗内被`react-virtualized`卸载
    if (!this.$.isConnected && !this.destroyed) {
      return;
    }
    if ((await Promise.all(
      this.events.dispatchWithReturn<boolean>(PromptEvent.Blur, this.$.value))
    ).some((r) => r === false)) {
      return;
    }

    if (!this.isInPendingCommitState) {
      this.destroy();
    }
  }
}
