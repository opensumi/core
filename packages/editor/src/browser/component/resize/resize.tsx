import * as React from 'react';
import * as styles from './resize.module.less';
import classnames from 'classnames';

export interface ResizeHandleProps {
  onFinished?: () => void;
  onResize?: () => void;
  max?: number;
  min?: number;
  preserve?: number; // percentage
  className?: string;
}

export class ResizeHandleHorizontal extends React.Component<ResizeHandleProps, any> {

  private ref: HTMLElement;

  private resizing: boolean = false;

  private startX: number = 0;

  private startPrevWidth: number = 0;

  private startNextWidth: number = 0;

  private prevElement: HTMLElement;

  private nextElement: HTMLElement;

  private onMouseDown = ((e) => {
    this.resizing = true;
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    this.startX = e.pageX;
    this.startPrevWidth = this.prevElement.offsetWidth;
    this.startNextWidth = this.nextElement.offsetWidth;
  });

  private onMouseMove = ((e) => {
    const prevWidth = this.startPrevWidth + e.pageX - this.startX;
    const nextWidth = this.startNextWidth - ( e.pageX - this.startX);
    const preserve = this.props.preserve || 0;
    if (this.requestFrame) {
      window.cancelAnimationFrame(this.requestFrame);
    }
    const parentWidth = this.ref!.parentElement!.offsetWidth;
    this.requestFrame = window.requestAnimationFrame(() => {
      this.nextElement.style.width = (nextWidth / parentWidth) * 100 + '%';
      this.prevElement.style.width = (prevWidth / parentWidth) * 100 + '%';
      if (this.props.onResize) {
        this.props.onResize();
      }
    });

  });

  private onMouseUp = ((e) => {
    this.resizing = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    if (this.props.onFinished) {
      this.props.onFinished();
    }
  });

  private requestFrame: any;

  componentDidMount() {
    this.ref!.addEventListener('mousedown', this.onMouseDown);
    this.prevElement = this.ref.previousSibling as HTMLElement;
    this.nextElement = this.ref.nextSibling as HTMLElement;
  }

  componentWillUnmount() {
    this.ref!.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  render() {
    return (<div ref={(e) => e && (this.ref = e) } className={classnames({
      [styles['resize-handle-horizontal']]: true,
    })}/>);
  }
}

export class ResizeHandleVertical extends React.Component<ResizeHandleProps, any> {

  private ref: HTMLElement;

  private resizing: boolean = false;

  private startY: number = 0;

  private startHeight: number = 0;

  private startPrevHeight: number = 0;

  private startNextHeight: number = 0;

  private prevElement: HTMLElement;

  private nextElement: HTMLElement;

  private requestFrame: any;

  private onMouseDown = ((e) => {
    this.resizing = true;
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    this.startY = e.pageY;
    this.startPrevHeight = this.prevElement.offsetHeight;
    this.startNextHeight = this.nextElement.offsetHeight;
  });

  private onMouseMove = ((e) => {
    const prevHeight = this.startPrevHeight + e.pageY - this.startY;
    const nextHeight = this.startNextHeight - ( e.pageY - this.startY);
    const preserve = this.props.preserve || 0;
    if (this.requestFrame) {
      window.cancelAnimationFrame(this.requestFrame);
    }
    const parentHeight = this.ref!.parentElement!.offsetHeight;
    this.requestFrame = window.requestAnimationFrame(() => {
      this.nextElement.style.height = (nextHeight / parentHeight) * 100 + '%';
      this.prevElement.style.height = (prevHeight / parentHeight) * 100 + '%';
      if (this.props.onResize) {
        this.props.onResize();
      }
    });
  });

  private onMouseUp = ((e) => {
    this.resizing = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    if (this.props.onFinished) {
      this.props.onFinished();
    }
  });

  componentDidMount() {
    this.ref!.addEventListener('mousedown', this.onMouseDown);
    this.prevElement = this.ref.previousSibling as HTMLElement;
    this.nextElement = this.ref.nextSibling as HTMLElement;
  }

  componentWillUnmount() {
    this.ref!.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  render() {
    return (<div ref={(e) => e && (this.ref = e) } className={classnames({
      [styles['resize-handle-vertical']]: true,
      [this.props.className || '']: true,
    })}/>);
  }
}
