import { bindInputElement, ProxiedInputProp } from '../../input';
import { DisposableCollection, Emitter, Event, IAsyncResult } from '../../utils';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export enum PROMPT_VALIDATE_TYPE {
  INFO = 1,
  ERROR = 2,
  WARNING = 3,
}

export interface PromptValidateMessage {
  message: string | void;
  type: PROMPT_VALIDATE_TYPE;
}

export enum VALIDATE_CLASS_NAME {
  INFO = 'validate-error',
  ERROR = 'validate-error',
  WARNING = 'validate-warning',
}

/**
 * 输入输出框需要在外部手动进行管理，由于我们使用的是虚拟的react节点渲染，一旦用户向上或向下滚动超出渲染访问，相关的React组件会被回收
 * 故这里在外部手动维护输入框对象
 */
export abstract class PromptHandle {
  public readonly $: HTMLInputElement;
  public readonly $validate: HTMLDivElement;
  public readonly $addonAfter: HTMLDivElement;
  public readonly ProxiedInput: (props: ProxiedInputProp) => JSX.Element;
  private disposables: DisposableCollection = new DisposableCollection();
  private isInPendingCommitState = false;
  private _destroyed = false;
  private _hasValidateElement = false;
  private _hasAddonAfter = false;
  private _validateClassName: string;

  // event
  private onChangeEmitter: Emitter<string> = new Emitter();
  private onCommitEmitter: Emitter<string> = new Emitter();
  private onCancelEmitter: Emitter<string> = new Emitter();
  private onFocusEmitter: Emitter<string> = new Emitter();
  private onBlurEmitter: Emitter<string> = new Emitter();
  private onDestroyEmitter: Emitter<string> = new Emitter();

  constructor() {
    this.$ = document.createElement('input');
    this.$.setAttribute('type', 'text');
    this.$.setAttribute('name', 'no_keybinding');
    // reset props
    this.$.setAttribute('spellcheck', 'false');
    this.$.setAttribute('autoCapitalize', 'off');
    this.$.setAttribute('autoCorrect', 'off');
    this.$.setAttribute('autoComplete', 'off');
    this.ProxiedInput = bindInputElement(this.$);
    this.$.addEventListener('click', this.handleClick);
    this.$.addEventListener('keyup', this.handleKeyup);
    this.$.addEventListener('keydown', this.handleKeydown);
    this.$.addEventListener('focus', this.handleFocus);
    this.$.addEventListener('blur', this.handleBlur);
    this.$validate = document.createElement('div');
    this.$validate.setAttribute('style', 'top: calc(100% - 1px);');
    this.$addonAfter = document.createElement('div');
    this.$addonAfter.setAttribute('class', 'kt-input-addon-after');
    // 可能存在PromptHandle创建后没被使用的情况
  }

  abstract get id(): number;

  abstract get depth(): number;

  get destroyed() {
    return this._destroyed;
  }

  get onChange(): Event<string> {
    return this.onChangeEmitter.event;
  }

  get onCommit(): Event<string> {
    return this.onCommitEmitter.event;
  }

  get onCancel(): Event<string> {
    return this.onCancelEmitter.event;
  }

  get onFocus(): Event<string> {
    return this.onFocusEmitter.event;
  }

  get onBlur(): Event<string> {
    return this.onBlurEmitter.event;
  }

  get onDestroy(): Event<string> {
    return this.onDestroyEmitter.event;
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

  public addAddonAfter(classname: string) {
    if (!this._hasAddonAfter && !this._destroyed) {
      this.$.parentElement?.parentElement?.appendChild(this.$addonAfter);
      this._hasAddonAfter = true;
    }
    const addElement = document.createElement('div');
    addElement.setAttribute('class', classname);
    this.$addonAfter.appendChild(addElement);
  }

  public removeAddonAfter() {
    if (this._hasAddonAfter) {
      this.$addonAfter.firstChild?.remove();
      this.$.parentElement?.parentElement?.removeChild(this.$addonAfter);
      this._hasAddonAfter = false;
    }
  }

  public addValidateMessage(validateMessage: PromptValidateMessage) {
    if (!this._hasValidateElement && !this._destroyed) {
      // 移动到与input-box同级别
      this.$.parentElement?.parentElement?.parentElement?.appendChild(this.$validate);
      this._hasValidateElement = true;
    }
    let validateBoxClassName = 'validate-message popup ';
    if (validateMessage && validateMessage.type === PROMPT_VALIDATE_TYPE.ERROR) {
      this._validateClassName = VALIDATE_CLASS_NAME.ERROR;
    } else if (validateMessage && validateMessage.type === PROMPT_VALIDATE_TYPE.WARNING) {
      this._validateClassName = VALIDATE_CLASS_NAME.WARNING;
    } else {
      this._validateClassName = VALIDATE_CLASS_NAME.INFO;
    }
    validateBoxClassName += this._validateClassName;

    this.$validate.classList.value = validateBoxClassName;
    this.$validate.innerText = validateMessage.message || '';
    this.$.parentElement?.parentElement?.classList.remove(
      VALIDATE_CLASS_NAME.INFO,
      VALIDATE_CLASS_NAME.ERROR,
      VALIDATE_CLASS_NAME.WARNING,
    );
    this.$.parentElement?.parentElement?.classList.add(this._validateClassName);
  }

  public removeValidateMessage() {
    if (this._hasValidateElement) {
      this.$.parentElement?.parentElement?.parentElement?.removeChild(this.$validate);
      this._hasValidateElement = false;
      this.$.parentElement?.parentElement?.classList.remove(this._validateClassName);
    }
  }

  public destroy(): void {
    if (this._destroyed) {
      return;
    }
    // 获取最顶层的父级焦点容器
    let element = this.focusPrevActiveElement();
    this._destroyed = true;
    this.$.removeEventListener('click', this.handleClick);
    this.$.removeEventListener('keyup', this.handleKeyup);
    this.$.removeEventListener('keydown', this.handleKeydown);
    this.$.removeEventListener('focus', this.handleFocus);
    this.$.removeEventListener('blur', this.handleBlur);
    this.removeValidateMessage();
    this.removeAddonAfter();
    this.$.disabled = false;
    this.onDestroyEmitter.fire(this.$.value);
    this.disposables.dispose();
    requestAnimationFrame(() => {
      element?.focus();
    });
  }

  private focusPrevActiveElement() {
    let parentElement = this.$.parentElement;
    while (parentElement) {
      if (typeof parentElement.attributes['tabindex'] !== 'undefined') {
        break;
      }
      parentElement = parentElement?.parentElement;
    }
    return parentElement;
  }

  private handleClick = (ev) => {
    ev.stopPropagation();
  };

  private handleKeyup = (ev) => {
    this.onChangeEmitter.fire(this.$.value);
  };

  private handleKeydown = async (ev) => {
    if (ev.key === 'Escape') {
      const res: IAsyncResult<boolean>[] = await this.onCancelEmitter.fireAndAwait(this.$.value);
      // 当有回调函数报错或返回结果为false时，终止后续操作
      if (res.some((r) => r.result === false || !!r.err)) {
        return;
      }
      this.destroy();
    }

    if (ev.key === 'Enter') {
      this.isInPendingCommitState = true;
      this.$.disabled = true;
      const res: IAsyncResult<boolean>[] = await this.onCommitEmitter.fireAndAwait(this.$.value);
      // 当有回调函数报错或返回结果为false时，终止后续操作
      if (res.some((r) => r.result === false || !!r.err)) {
        this.isInPendingCommitState = false;
        this.$.disabled = false;
        this.$.focus();
        return;
      }
      this.isInPendingCommitState = false;
      this.$.disabled = false;
      this.destroy();
    }
  };

  private handleFocus = () => {
    this.onFocusEmitter.fire(this.$.value);
  };

  private handleBlur = async (ev) => {
    // 如果Input由于`react-virtualized`被从视图中卸载，在下一帧前Input的isConnected属性不会被更新
    await delay(0);

    // 如果Input组件不在DOM中，但也没有被手动销毁，则表示由于其不在视窗内被`react-virtualized`卸载
    if (!this.$.isConnected && !this.destroyed) {
      return;
    }
    const res: IAsyncResult<boolean>[] = await this.onBlurEmitter.fireAndAwait(this.$.value);
    // 当有回调函数报错或返回结果为false时，终止后续操作
    if (res.some((r) => r.result === false || !!r.err)) {
      return;
    }

    if (!this.isInPendingCommitState) {
      this.destroy();
    }
  };
}
