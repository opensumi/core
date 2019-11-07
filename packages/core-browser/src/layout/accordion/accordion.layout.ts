import { Widget, SplitLayout, LayoutItem, SplitPanel, PanelLayout } from '@phosphor/widgets';
import { Event, Emitter } from '@ali/ide-core-common';
import { SplitPositionHandler, SplitPositionOptions } from '../split-panels';
import { MessageLoop, Message } from '@phosphor/messaging';
import { IIterator, map, toArray, find } from '@phosphor/algorithm';
import debounce = require('lodash.debounce');
import { ViewContainerSection } from './section.view';

export class ViewContainerLayout extends SplitLayout {
  constructor(protected options: ViewContainerLayout.Options, protected readonly splitPositionHandler: SplitPositionHandler) {
    super(options);
  }

  protected readonly layoutUpdateEmitter = new Emitter<void>();
  public onLayoutUpdate: Event<void> = this.layoutUpdateEmitter.event;

  protected get items(): ReadonlyArray<LayoutItem & ViewContainerLayout.Item> {
    // tslint:disable-next-line:no-any
    return (this as any)._items as Array<LayoutItem & ViewContainerLayout.Item>;
  }

  iter(): IIterator<ViewContainerSection> {
    return map(this.items, (item) => item.widget);
  }

  get widgets(): ViewContainerSection[] {
    return toArray(this.iter());
  }

  moveWidget(fromIndex: number, toIndex: number, widget: Widget): void {
    const ref = this.widgets[toIndex < fromIndex ? toIndex : toIndex + 1];
    super.moveWidget(fromIndex, toIndex, widget);
    if (ref) {
      this.parent!.node.insertBefore(this.handles[toIndex], ref.node);
    } else {
      this.parent!.node.appendChild(this.handles[toIndex]);
    }
    MessageLoop.sendMessage(widget, Widget.Msg.BeforeDetach);
    this.parent!.node.removeChild(widget.node);
    MessageLoop.sendMessage(widget, Widget.Msg.AfterDetach);

    MessageLoop.sendMessage(widget, Widget.Msg.BeforeAttach);
    this.parent!.node.insertBefore(widget.node, this.handles[toIndex]);
    MessageLoop.sendMessage(widget, Widget.Msg.AfterAttach);
  }

  getPartSize(part: ViewContainerSection): number | undefined {
    if (part.collapsed || part.isHidden) {
      return part.uncollapsedSize;
    }
    return part.node.offsetHeight;
  }

  /**
   * Set the sizes of the view container parts according to the given weights
   * by moving the split handles. This is similar to `setRelativeSizes` defined
   * in `SplitLayout`, but here we properly consider the collapsed / expanded state.
   */
  setPartSizes(weights: (number | undefined)[]): void {
    const parts = this.widgets;
    const availableSize = this.getAvailableSize();

    // Sum up the weights of visible parts
    let totalWeight = 0;
    let weightCount = 0;
    for (let index = 0; index < weights.length && index < parts.length; index++) {
      const part = parts[index];
      const weight = weights[index];
      if (weight && !part.isHidden && !part.collapsed) {
        totalWeight += weight;
        weightCount++;
      }
    }
    if (weightCount === 0 || availableSize === 0) {
      return;
    }

    // Add the average weight for visible parts without weight
    const averageWeight = totalWeight / weightCount;
    for (let index = 0; index < weights.length && index < parts.length; index++) {
      const part = parts[index];
      const weight = weights[index];
      if (!weight && !part.isHidden && !part.collapsed) {
        totalWeight += averageWeight;
      }
    }

    // Apply the weights to compute actual sizes
    let position = 0;
    for (let index = 0; index < weights.length && index < parts.length - 1; index++) {
      const part = parts[index];
      if (!part.isHidden) {
        position += this.options.headerSize;
        const weight = weights[index];
        if (part.collapsed) {
          if (weight) {
            part.uncollapsedSize = weight / totalWeight * availableSize;
          }
        } else {
          let contentSize = (weight || averageWeight) / totalWeight * availableSize;
          const minSize = part.minSize;
          if (contentSize < minSize) {
            contentSize = minSize;
          }
          position += contentSize;
        }
        this.setHandlePosition(index, position);
        position += this.spacing;
      }
    }
  }

  /**
   * Determine the size of the split panel area that is available for widget content,
   * i.e. excluding part headers and split handles.
   */
  getAvailableSize(): number {
    if (!this.parent || !this.parent.isAttached) {
      return 0;
    }
    const parts = this.widgets;
    const visiblePartCount = parts.filter((part) => !part.isHidden).length;
    let availableSize: number;
    availableSize = this.parent.node.offsetHeight;
    availableSize -= visiblePartCount * this.options.headerSize;
    availableSize -= (visiblePartCount - 1) * this.spacing;
    if (availableSize < 0) {
      return 0;
    }
    return availableSize;
  }

  /**
   * Update a view container part that has been collapsed or expanded. The transition
   * to the new state is animated.
   */
  updateCollapsed(part: ViewContainerSection, enableAnimation: boolean, callback?: () => void): void {
    const index = this.items.findIndex((item) => item.widget === part);
    if (index < 0 || !this.parent || part.isHidden) {
      return;
    }

    // Do not store the height of the "stretched item". Otherwise, we mess up the "hint height".
    // Store the height only if there are other expanded items.
    const currentSize = part.node.offsetHeight;
    if (part.collapsed && this.items.some((item) => !item.widget.collapsed && !item.widget.isHidden)) {
      part.uncollapsedSize = currentSize;
    }

    if (!enableAnimation || this.options.animationDuration <= 0) {
      MessageLoop.postMessage(this.parent!, Widget.Msg.FitRequest);
      return;
    }
    let startTime: number | undefined;
    const duration = this.options.animationDuration;
    const direction = part.collapsed ? 'collapse' : 'expand';
    let fullSize: number;
    if (direction === 'collapse') {
      fullSize = currentSize - this.options.headerSize;
    } else {
      fullSize = Math.max((part.uncollapsedSize || 0) - this.options.headerSize, part.minSize);
      if (this.items.filter((item) => !item.widget.collapsed && !item.widget.isHidden).length === 1) {
        // Expand to full available size
        fullSize = Math.max(fullSize, this.getAvailableSize());
      }
    }
    // The update function is called on every animation frame until the predefined duration has elapsed.
    const updateFunc = (time: number) => {
      if (startTime === undefined) {
        startTime = time;
      }
      if (time - startTime < duration) {
        // Render an intermediate state for the animation
        const t = this.tween((time - startTime) / duration);
        if (direction === 'collapse') {
          part.animatedSize = (1 - t) * fullSize;
        } else {
          part.animatedSize = t * fullSize;
        }
        requestAnimationFrame(updateFunc);
      } else {
        // The animation is finished
        if (direction === 'collapse') {
          part.animatedSize = undefined;
          if (callback) { callback(); }
        } else {
          part.animatedSize = fullSize;
          // Request another frame to reset the part to variable size
          requestAnimationFrame(() => {
            part.animatedSize = undefined;
            MessageLoop.sendMessage(this.parent!, Widget.Msg.FitRequest);
            if (callback) { callback(); }
          });
        }
      }
      MessageLoop.sendMessage(this.parent!, Widget.Msg.FitRequest);
    };
    requestAnimationFrame(updateFunc);
  }

  protected onFitRequest(msg: Message): void {
    for (const part of this.widgets) {
      const style = part.node.style;
      if (part.animatedSize !== undefined) {
        // The part size has been fixed for animating the transition to collapsed / expanded state
        const fixedSize = `${this.options.headerSize + part.animatedSize}px`;
        style.minHeight = fixedSize;
        style.maxHeight = fixedSize;
      } else if (part.collapsed) {
        // The part size is fixed to the header size
        const fixedSize = `${this.options.headerSize}px`;
        style.minHeight = fixedSize;
        style.maxHeight = fixedSize;
      } else {
        const minSize = `${this.options.headerSize + part.minSize}px`;
        style.minHeight = minSize;
        style.maxHeight = '';
      }
    }
    super.onFitRequest(msg);
  }

  private debounceUpdate: any = debounce(() => {
    this.layoutUpdateEmitter.fire();
  }, 200);

  onUpdateRequest(msg) {
    this.debounceUpdate();
    super.onUpdateRequest(msg);
  }
  /**
   * Sinusoidal tween function for smooth animation.
   */
  protected tween(t: number): number {
    return 0.5 * (1 - Math.cos(Math.PI * t));
  }

  setHandlePosition(index: number, position: number): Promise<void> {
    const options: SplitPositionOptions = {
      referenceWidget: this.widgets[index],
      duration: 0,
    };
    // tslint:disable-next-line:no-any
    return this.splitPositionHandler.setSplitHandlePosition(this.parent as SplitPanel, index, position, options) as Promise<any>;
  }

}

export namespace ViewContainerLayout {

  export interface Options extends SplitLayout.IOptions {
    headerSize: number;
    animationDuration: number;
  }

  export interface Item {
    readonly widget: ViewContainerSection;
  }

}
