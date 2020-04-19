import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { IToolbarActionReactElement, IToolbarActionElementProps, IToolbarActionBtnStyle, IToolbarActionBtnProps, IToolbarActionBtnDelegate, IToolbarActionBtnState } from '../types';
import { useInjectable } from '../../react-hooks';
import { BasicEvent, Disposable, Emitter } from '@ali/ide-core-common';
import * as classnames from 'classnames';
import { AppConfig, ConfigProvider } from '../../react-providers';

export const ToolbarActionBtn = (props: IToolbarActionBtnProps & IToolbarActionElementProps) => {

  const context = useInjectable(AppConfig);
  const ref = React.useRef<HTMLDivElement>();
  const [viewState, setViewState] = React.useState(props.defaultState || 'default');
  const [title, setTitle] = React.useState(undefined);

  const { defaultButtonStyle = {} } = props.preferences || {} ;

  const styles: IToolbarActionBtnState = {
    title: props.title,
    iconClass: props.iconClass,
    ...defaultButtonStyle,
    ...(props.styles || {})[viewState] || {},
  };
  if (title) {
    styles.title = title;
  }

  const delegate = React.useRef<ToolbarBtnDelegate | undefined>();

  React.useEffect(() => {
    const disposer = new Disposable();
    if (ref.current && props.delegate) {
      delegate.current = new ToolbarBtnDelegate(ref.current, props.id, (state, title) => {
        setViewState(state);
        setTitle(title);
      }, () => {
        return viewState;
      }, context, props.popoverComponent);
      props.delegate(delegate.current);
      disposer.addDispose(delegate.current);
      disposer.addDispose({
        dispose: () => {
          props.delegate && props.delegate(undefined);
        },
      });
    }
    return () => disposer.dispose();
  }, [ref.current]);

  return <div className={ classnames({'kt-toolbar-action-btn': true,
  'kt-toolbar-action-btn-button': styles.btnStyle === 'button',
  'kt-toolbar-action-btn-inline': styles.btnStyle !== 'button',
  'action-btn-in-dropdown': props.inDropDown,
  'kt-toolbar-action-btn-vertical': styles.btnTitleStyle === 'vertical',
  'kt-toolbar-action-btn-horizontal': styles.btnTitleStyle !== 'vertical'})} onClick={(event) => {
        delegate.current && delegate.current._onClick.fire(event);
      }} onMouseEnter={(event) => {
        delegate.current && delegate.current._onMouseEnter.fire(event);
      }} onMouseLeave={(event) => {
        delegate.current && delegate.current._onMouseLeave.fire(event);
      }}  style={{
        backgroundColor: styles.background,
      }} ref={ref as any}>
    <div className={styles.iconClass + ' kt-toolbar-action-btn-icon'} title={styles.title} style={{
        color: styles.iconForeground,
        backgroundColor: styles.iconBackground,
    }}></div>
    {
      (styles.showTitle || props.inDropDown) ? <div className = 'kt-toolbar-action-btn-title' style={{
        color: styles.titleForeground,
        backgroundColor: styles.titleBackground,
      }}>{styles.title}</div> : null
    }
  </div>;

};

export function createToolbarActionBtn(props: IToolbarActionBtnProps): IToolbarActionReactElement {
  return ( actionProps ) => {
    return <ToolbarActionBtn {...actionProps} {...props} />;
  };
}

export class ToolbarActionBtnClickEvent extends BasicEvent<{
  id: string,
  event: React.MouseEvent<HTMLDivElement, MouseEvent>,
}> {}

const popOverMap = new Map<string, Promise<HTMLDivElement>>();

class ToolbarBtnDelegate implements IToolbarActionBtnDelegate {

  _onClick = new Emitter<React.MouseEvent<HTMLDivElement>>();
  onClick = this._onClick.event;

  _onMouseLeave = new Emitter<React.MouseEvent<HTMLDivElement>>();
  onMouseLeave = this._onClick.event;

  _onMouseEnter = new Emitter<React.MouseEvent<HTMLDivElement>>();
  onMouseEnter = this._onClick.event;

  _onChangeState = new Emitter<{from: string, to: string}>();
  onChangeState = this._onChangeState.event;

  private popOverContainer: HTMLDivElement | undefined;

  private _popOverElement: Promise<HTMLDivElement> | undefined;

  dispose() {
    this._onClick.dispose();
    this._onMouseEnter.dispose();
    this._onMouseLeave.dispose();
    if (this.popOverContainer) {
      this.popOverContainer.remove();
      this.popOverContainer = undefined;
    }
  }

  constructor(private element: HTMLElement, private actionId: string,  private readonly _setState, private _getState, private context: AppConfig, private popoverComponent?: React.FC) {
    if (this.popoverComponent) {
      this._popOverElement = popOverMap.get(actionId);
      this.popOverContainer = document.createElement('div');
      element.append(this.popOverContainer);
    }
  }

  setState(to, title?) {
    const from = this._getState();
    this._setState(to, title);
    this._onChangeState.fire({from, to});
  }

  getRect() {
    return this.element.getBoundingClientRect();
  }

  getPopOverContainer() {
    return this.popOverContainer;
  }

  async showPopOver() {
    if (!this.popOverContainer) {
      return;
    }
    if (!this._popOverElement) {
      this._popOverElement = new Promise((resolve) => {
        const div = document.createElement('div');
        const C = this.popoverComponent!;
        ReactDOM.render(<ConfigProvider value={this.context}>
          <C/>
        </ConfigProvider>, div, () => {
          resolve();
        });
      });
      popOverMap.set(this.actionId, this._popOverElement);
    }
    return this._popOverElement.then((ele) => {
        if (this.popOverContainer && ele.parentElement !== this.popOverContainer) {
          this.popOverContainer.append(ele);
        }
    });
  }

}
