import CloseOutlined from '@ant-design/icons/CloseOutlined';
import cls from 'classnames';
import PropTypes from 'prop-types';
import Dialog from 'rc-dialog';
import addEventListener from 'rc-util/lib/Dom/addEventListener';
import React, { PropsWithChildren } from 'react';

import { Button } from '../button';

import { ModalLocale, getConfirmLocale } from './locale';

import type { ButtonProps, ButtonType } from '../button';

let mousePosition: { x: number; y: number } | null;
export const destroyFns: Array<() => void> = [];

// ref: https://github.com/ant-design/ant-design/issues/15795
const getClickPosition = (e: MouseEvent) => {
  mousePosition = {
    x: e.pageX,
    y: e.pageY,
  };
  // 100ms 内发生过点击事件，则从点击位置动画展示
  // 否则直接 zoom 展示
  // 这样可以兼容非点击方式展开
  setTimeout(() => (mousePosition = null), 100);
};

// 只有点击事件支持从鼠标位置动画展开
if (typeof window !== 'undefined' && window.document && window.document.documentElement) {
  addEventListener(document.documentElement, 'click', getClickPosition);
}

export interface ModalProps {
  /** 对话框是否可见 */
  visible?: boolean;
  /** 确定按钮 loading */
  confirmLoading?: boolean;
  /** 标题 */
  title?: React.ReactNode | string;
  /** 是否显示右上角的关闭按钮 */
  closable?: boolean;
  /** 点击确定回调 */
  onOk?: (e: React.MouseEvent<HTMLElement>) => void;
  /** 点击模态框右上角叉、取消按钮、Props.maskClosable 值为 true 时的遮罩层或键盘按下 Esc 时的回调 */
  onCancel?: (e: React.MouseEvent<HTMLElement>) => void;
  /** 关闭后的回调 */
  afterClose?: () => void;
  /** 垂直居中 */
  centered?: boolean;
  /** 宽度 */
  width?: string | number;
  /** 底部内容 */
  footer?: React.ReactNode;
  /** 确认按钮文字 */
  okText?: React.ReactNode;
  /** 确认按钮类型 */
  okType?: ButtonType;
  /** 取消按钮文字 */
  cancelText?: React.ReactNode;
  /** 点击蒙层是否允许关闭 */
  maskClosable?: boolean;
  /** 强制渲染 Modal */
  forceRender?: boolean;
  /** 确认按钮的属性 */
  okButtonProps?: ButtonProps<string>;
  /** 取消按钮的属性 */
  cancelButtonProps?: ButtonProps<string>;
  /** 关闭时是否销毁 Modal 内的子元素 */
  destroyOnClose?: boolean;
  /** 样式 */
  style?: React.CSSProperties;
  /** 包裹元素的类名 */
  wrapClassName?: string;
  /** 遮罩层的过渡动画名称 */
  maskTransitionName?: string;
  /** Modal 的过渡动画名称 */
  transitionName?: string;
  /** 样式名 */
  className?: string;
  /** 渲染 Modal 的容器 */
  getContainer?: string | HTMLElement | getContainerFunc | false | null;
  /** 层级 */
  zIndex?: number;
  /** 内容区域的样式 */
  bodyStyle?: React.CSSProperties;
  /** 遮罩层的样式 */
  maskStyle?: React.CSSProperties;
  /** 是否显示遮罩层 */
  mask?: boolean;
  /** 是否支持键盘操作 */
  keyboard?: boolean;
  /** 包裹元素的属性 */
  wrapProps?: any;
  /** 类名前缀 */
  prefixCls?: string;
  /** 关闭按钮的自定义图标 */
  closeIcon?: React.ReactNode;
  /** 是否开启动画过渡效果 */
  animation?: boolean;
}

type getContainerFunc = () => HTMLElement;

export interface ModalFuncProps {
  prefixCls?: string;
  className?: string;
  visible?: boolean;
  title?: React.ReactNode;
  content?: React.ReactNode;
  onOk?: (...args: any[]) => any;
  onCancel?: (...args: any[]) => any;
  okButtonProps?: ButtonProps<string>;
  cancelButtonProps?: ButtonProps<string>;
  centered?: boolean;
  width?: string | number;
  okText?: React.ReactNode;
  okType?: ButtonType;
  cancelText?: React.ReactNode;
  icon?: React.ReactNode;
  /* Deprecated */
  iconType?: string;
  mask?: boolean;
  maskClosable?: boolean;
  zIndex?: number;
  okCancel?: boolean;
  style?: React.CSSProperties;
  maskStyle?: React.CSSProperties;
  type?: string;
  keyboard?: boolean;
  getContainer?: string | HTMLElement | getContainerFunc | false | null;
  autoFocusButton?: null | 'ok' | 'cancel';
  transitionName?: string;
  maskTransitionName?: string;
}

export type ModalFunc = (props: ModalFuncProps) => {
  destroy: () => void;
  update: (newConfig: ModalFuncProps) => void;
};

export default class Modal extends React.Component<PropsWithChildren<ModalProps>, {}> {
  static info: ModalFunc;

  static success: ModalFunc;

  static error: ModalFunc;

  static warn: ModalFunc;

  static warning: ModalFunc;

  static confirm: ModalFunc;

  static destroyAll: () => void;

  static defaultProps = {
    width: 520,
    confirmLoading: false,
    visible: false,
    okType: 'primary' as ButtonType,
  };

  static propTypes = {
    prefixCls: PropTypes.string,
    onOk: PropTypes.func,
    onCancel: PropTypes.func,
    okText: PropTypes.node,
    cancelText: PropTypes.node,
    centered: PropTypes.bool,
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    confirmLoading: PropTypes.bool,
    visible: PropTypes.bool,
    footer: PropTypes.node,
    title: PropTypes.node,
    closable: PropTypes.bool,
    closeIcon: PropTypes.node,
  };

  handleCancel = (e: any) => {
    const { onCancel } = this.props;
    if (onCancel) {
      onCancel(e);
    }
  };

  handleOk = (e: React.MouseEvent<HTMLButtonElement>) => {
    const { onOk } = this.props;
    if (onOk) {
      onOk(e);
    }
  };

  renderFooter = (locale: ModalLocale) => {
    const { okText, okType, cancelText, confirmLoading } = this.props;
    return (
      <div>
        <Button onClick={this.handleCancel} {...this.props.cancelButtonProps}>
          {cancelText || locale.cancelText}
        </Button>
        <Button type={okType} loading={confirmLoading} onClick={this.handleOk} {...this.props.okButtonProps}>
          {okText || locale.okText}
        </Button>
      </div>
    );
  };

  renderModal = () => {
    const {
      prefixCls: customizePrefixCls,
      footer,
      visible,
      wrapClassName,
      centered,
      getContainer,
      closeIcon,
      closable = true,
      ...restProps
    } = this.props as any;

    const prefixCls = customizePrefixCls || 'kt-modal';
    const defaultFooter = this.renderFooter(getConfirmLocale());

    const closeIconToRender = (
      <span className={`${prefixCls}-close-x`}>
        {closeIcon || <CloseOutlined className={`${prefixCls}-close-icon`} />}
      </span>
    );

    return (
      <Dialog
        {...restProps}
        animation={this.props.animation}
        getContainer={getContainer}
        prefixCls={prefixCls}
        wrapClassName={cls({ [`${prefixCls}-centered`]: !!centered }, wrapClassName)}
        footer={footer === undefined ? defaultFooter : footer}
        visible={visible}
        mousePosition={mousePosition}
        onClose={this.handleCancel}
        closeIcon={closeIconToRender}
      />
    );
  };

  render() {
    return this.renderModal();
  }
}
