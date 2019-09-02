import * as React from 'react';
import * as PropTypes from 'prop-types';
import HotkeysJS, { FilterEvent, HotkeysEvent } from 'hotkeys-js';

export type OnKeyFun = (shortcut: string, evn: KeyboardEvent, handle: HotkeysEvent) => void;

export interface IReactHotkeysProps {
  keyName?: string;
  filter?: (event: FilterEvent) => boolean;
  onKeyUp?: OnKeyFun;
  onKeyDown?: OnKeyFun;
  allowRepeat?: boolean;
}

export default class Hotkeys extends React.Component<IReactHotkeysProps> {

  public static defaultProps: IReactHotkeysProps = {
    filter(event: FilterEvent) {
      const target = (event.target as HTMLElement) || event.srcElement;
      const tagName = target.tagName;
      return !(target.isContentEditable || tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA');
    },
  };

  static propTypes = {
    keyName: PropTypes.string,
    filter: PropTypes.func,
    onKeyDown: PropTypes.func,
    onKeyUp: PropTypes.func,
  };

  private isKeyDown: boolean = false;
  private handle: HotkeysEvent;
  constructor(props: IReactHotkeysProps) {
    super(props);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.handleKeyUpEvent = this.handleKeyUpEvent.bind(this);
    this.handle = {} as HotkeysEvent;
  }
  componentDidMount() {
    const { filter } = this.props;
    if (filter) {
      HotkeysJS.filter = filter;
    }
    HotkeysJS.unbind(this.props.keyName!);
    HotkeysJS(this.props.keyName!, this.onKeyDown);
    document.body.addEventListener('keyup', this.handleKeyUpEvent);
  }
  componentWillUnmount() {
    HotkeysJS.unbind(this.props.keyName!);
    this.isKeyDown = true;
    this.handle = {} as HotkeysEvent;
    document.body.removeEventListener('keyup', this.handleKeyUpEvent);
  }
  onKeyUp(e: KeyboardEvent, handle: HotkeysEvent) {
    const { onKeyUp } = this.props;
    if (onKeyUp) {
      onKeyUp(handle.shortcut, e, handle);
    }
  }
  onKeyDown(e: KeyboardEvent, handle: HotkeysEvent) {
    const { onKeyDown, allowRepeat } = this.props;
    if (this.isKeyDown && !allowRepeat) { return; }
    this.isKeyDown = true;
    this.handle = handle;
    if (onKeyDown) {
      onKeyDown(handle.shortcut, e, handle);
    }
  }
  handleKeyUpEvent(e: KeyboardEvent) {
    if (!this.isKeyDown) { return; }
    this.isKeyDown = false;
    if (this.props.keyName && this.props.keyName.indexOf(this.handle.shortcut) < 0) { return; }
    this.onKeyUp(e, this.handle);
    this.handle = {} as HotkeysEvent;
  }
  render() {
    return this.props.children || null;
  }
}
