import classnames from 'classnames';
import React from 'react';
import { MouseEvent, UIEvent } from 'react';

import styles from './scroll.module.less';

export interface ScrollAreaProps {
  className?: string;
  onScroll?: (position: ScrollPosition) => any;
  atTopClassName?: string;
  style?: any;
  containerStyle?: any;
  delegate?: (delegate: IScrollDelegate) => void;
}

export interface IScrollDelegate {
  scrollTo(position: ScrollPosition): void;
}

export interface ScrollPosition {
  top: number;
  left: number;
}

export interface ScrollSizes {
  scrollHeight: number;
  offsetHeight: number;
  offsetWidth: number;
  scrollWidth: number;
}

export class Scroll extends React.Component<ScrollAreaProps, any> {
  public ref: HTMLDivElement;

  public container: HTMLDivElement;

  private thumbV!: HTMLDivElement;

  private trackV!: HTMLDivElement;

  private thumbH!: HTMLDivElement;

  private trackH!: HTMLDivElement;

  private size: ScrollSizes;

  private position: ScrollPosition = {
    top: 0,
    left: 0,
  };

  private dragging = false;

  private draggingStart = 0;

  private draggingStartPos = 0;

  private requestFrame: any;

  private shouldHideThumb = true;

  private isAtTop = true;

  onScroll(e: UIEvent<HTMLDivElement>) {
    this.position = {
      top: this.ref.scrollTop,
      left: this.ref.scrollLeft,
    };
    if (this.props.onScroll) {
      this.props.onScroll(this.position);
    }
    this.update(() => {
      const contentWidth = this.ref.scrollWidth;
      const width = this.ref.offsetWidth;
      const contentHeight = this.ref.scrollHeight;
      const height = this.ref.offsetHeight;
      this.thumbH.style.left = (this.position.left * width) / contentWidth + 'px';
      this.thumbV.style.top = (this.position.top * height) / contentHeight + 'px';
    });
    if (!this.isAtTop && this.ref.scrollTop === 0) {
      this.isAtTop = true;
      this.setCss();
    } else if (this.isAtTop && this.ref.scrollTop !== 0) {
      this.isAtTop = false;
      this.setCss();
    }
  }

  scrollTo(position: ScrollPosition) {
    this.ref.scrollLeft = position.left;
    this.ref.scrollTop = position.top;
  }

  onMouseDownHorizontal(e: MouseEvent<HTMLDivElement>) {
    this.dragging = true;
    if (e.target === this.trackH) {
      this.onMouseDownOnTrack(e);
    }
    this.draggingStart = e.pageX;
    this.draggingStartPos = this.ref.scrollLeft;
    document.addEventListener('mousemove', this.onMouseMoveHorizontal);
    document.addEventListener('mouseup', this.onMouseUpHorizontal);
  }

  onMouseMoveHorizontal = (e) => {
    if (!this.dragging) {
      return;
    }
    const move = e.pageX - this.draggingStart;
    this.ref.scrollLeft = this.draggingStartPos + this.calculateXToLeft(move);
  };

  onMouseUpHorizontal = (e) => {
    this.dragging = false;
    document.removeEventListener('mousemove', this.onMouseMoveHorizontal);
    document.removeEventListener('mouseup', this.onMouseUpHorizontal);
    if (this.shouldHideThumb) {
      this.hideThumb();
    }
  };

  onMouseDownOnTrack(e: MouseEvent<HTMLDivElement>) {
    const track = e.target as HTMLDivElement;
    const x = e.clientX - track.getBoundingClientRect().left;
    const contentWidth = this.ref.scrollWidth;
    const width = this.ref.offsetWidth;
    const left = (x * contentWidth) / width - 0.5 * width;
    this.scrollTo({
      left,
      top: this.position.top,
    });
  }

  calculateXToLeft(x) {
    const contentWidth = this.ref.scrollWidth;
    const width = this.ref.offsetWidth;
    return (x * contentWidth) / width;
  }

  onMouseDownVertical(e: MouseEvent<HTMLDivElement>) {
    this.dragging = true;
    if (e.target === this.trackV) {
      this.onMouseDownOnTrackVertical(e);
    }
    this.draggingStart = e.pageY;
    this.draggingStartPos = this.ref.scrollTop;
    document.addEventListener('mousemove', this.onMouseMoveVertical);
    document.addEventListener('mouseup', this.onMouseUpVertical);
  }

  onMouseMoveVertical = (e) => {
    if (!this.dragging) {
      return;
    }
    const move = e.pageY - this.draggingStart;
    this.ref.scrollTop = this.draggingStartPos + this.calculateYToTop(move);
  };

  onMouseUpVertical = (e) => {
    this.dragging = false;
    document.removeEventListener('mousemove', this.onMouseMoveVertical);
    document.removeEventListener('mouseup', this.onMouseUpVertical);
    if (this.shouldHideThumb) {
      this.hideThumb();
    }
  };

  onMouseDownOnTrackVertical(e: MouseEvent<HTMLDivElement>) {
    const track = e.target as HTMLDivElement;
    const x = e.clientY - track.getBoundingClientRect().top;
    const contentHeight = this.ref.scrollHeight;
    const height = this.ref.offsetHeight;
    const top = (x * contentHeight) / height - 0.5 * height;
    this.scrollTo({
      left: this.position.left,
      top,
    });
  }

  onMousewheel = (e: WheelEvent) => {
    // 鼠标滚动滚轮只在有横向滚动条的情况下
    // 页面有缩放的时候，scrollHeight 可能会小于 clientHeight / offsetHeight
    if (this.ref.clientHeight >= this.ref.scrollHeight) {
      // scrollLeft 内部有边界判断
      this.ref.scrollLeft += e.deltaY;
    }
  };

  calculateYToTop(y) {
    const contentHeight = this.ref.scrollHeight;
    const height = this.ref.offsetHeight;
    return (y * contentHeight) / height;
  }

  componentDidUpdate() {
    this.update();
    if (this.props.delegate) {
      this.props.delegate({
        scrollTo: this.scrollTo.bind(this),
      });
    }
  }

  componentDidMount() {
    this.update();
    window.addEventListener('resize', this.handleWindowResize);
    if (this.props.delegate) {
      this.props.delegate({
        scrollTo: this.scrollTo.bind(this),
      });
    }
    if (this.ref) {
      this.ref.addEventListener('mouseenter', this.onMouseEnter);
      this.ref.addEventListener('wheel', this.onMousewheel);
    }
  }

  onMouseEnter = () => {
    this.update();
  };

  componentWillUnmount() {
    if (this.ref) {
      this.ref.removeEventListener('mouseenter', this.onMouseEnter);
      this.ref.addEventListener('wheel', this.onMousewheel);
    }
    window.removeEventListener('resize', this.handleWindowResize);
    if (this.requestFrame) {
      window.cancelAnimationFrame(this.requestFrame);
    }
  }

  handleWindowResize = () => {
    this.update();
  };

  sizeEqual(size1: ScrollSizes, size2: ScrollSizes): boolean {
    return (
      size1 &&
      size2 &&
      size1.offsetHeight === size2.offsetHeight &&
      size1.scrollHeight === size2.scrollHeight &&
      size1.offsetWidth === size2.offsetWidth &&
      size1.scrollWidth === size2.scrollWidth
    );
  }

  update = (callback?) => {
    if (this.requestFrame) {
      window.cancelAnimationFrame(this.requestFrame);
    }
    this.requestFrame = window.requestAnimationFrame(() => {
      this._update();
      if (callback) {
        callback();
      }
    });
  };

  _update() {
    if (this.ref) {
      if (!this.sizeEqual(this.size, this.ref)) {
        this.size = {
          offsetHeight: this.ref.offsetHeight,
          offsetWidth: this.ref.offsetWidth,
          scrollWidth: this.ref.scrollWidth,
          scrollHeight: this.ref.scrollHeight,
        };
        this.updateScrollBar();
      }
    }
  }

  updateScrollBar() {
    const contentWidth = this.ref.scrollWidth;
    const width = this.ref.offsetWidth;
    if (width < contentWidth) {
      const thumbHWidth = (width * width) / contentWidth;
      this.thumbH.style.width = thumbHWidth + 'px';
      this.trackH.parentElement!.style.display = 'block';
    } else {
      this.trackH.parentElement!.style.display = 'none';
    }
    const contentHeight = this.ref.scrollHeight;
    const height = this.ref.offsetHeight;
    if (height < contentHeight) {
      this.thumbV.style.height = (height * height) / contentHeight + 'px';
      this.trackV.parentElement!.style.display = 'block';
    } else {
      this.trackV.parentElement!.style.display = 'none';
    }
  }

  hideThumb() {
    this.shouldHideThumb = true;
    if (!this.dragging) {
      this.setCss();
    }
  }

  showThumb() {
    this.shouldHideThumb = false;
    this.setCss();
  }

  setCss() {
    this.container.className = classnames({
      [styles.scroll]: true,
      [styles['hide-thumb']]: this.shouldHideThumb && !this.dragging,
    });
    const cls = {};
    if (this.props.atTopClassName) {
      cls[this.props.atTopClassName] = this.isAtTop;
    }
    if (this.props.className) {
      cls[this.props.className] = true;
    }
    this.ref.className = classnames(cls);
  }

  render() {
    return (
      <div
        className={classnames(styles.scroll, styles['hide-thumb'])}
        ref={(e) => e && (this.container = e)}
        onMouseMove={() => this.showThumb()}
        onMouseLeave={() => this.hideThumb()}
        style={this.props.containerStyle}
      >
        <div
          style={this.props.style}
          className={classnames(this.props.className)}
          onScroll={this.onScroll.bind(this)}
          ref={(e) => e && (this.ref = e)}
          onMouseDown={() => this.update()}
          onMouseUp={() => this.update()}
        >
          {this.props.children}
        </div>
        <div className={styles['scroll-horizontal']}>
          <div
            className={styles['track-horizontal']}
            ref={(e) => e && (this.trackH = e)}
            onMouseDown={this.onMouseDownHorizontal.bind(this)}
          />
          <div
            className={'thumb-horizontal'}
            onMouseDown={this.onMouseDownHorizontal.bind(this)}
            ref={(e) => e && (this.thumbH = e)}
          />
        </div>
        <div className={styles['scroll-vertical']}>
          <div
            className={styles['track-vertical']}
            ref={(e) => e && (this.trackV = e)}
            onMouseDown={this.onMouseDownVertical.bind(this)}
          />
          <div
            className={'thumb-vertical'}
            onMouseDown={this.onMouseDownVertical.bind(this)}
            ref={(e) => e && (this.thumbV = e)}
          />
        </div>
      </div>
    );
  }
}
