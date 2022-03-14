import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { ITerminalHoverManagerService } from '../common';

import { ILinkHoverTargetOptions } from './links/link-manager';

const TIPS_OFFSET_Y = 20;
const TIPS_OFFSET_X = 5;

@Injectable()
export class TerminalHoverManagerService implements ITerminalHoverManagerService {
  private hoverOverlay: HTMLElement | undefined;
  private hoverWidget: HTMLElement | undefined;

  private appendTerminalHoverOverlay() {
    const overlayContainer = document.querySelector('#ide-overlay');

    if (!overlayContainer) {
      throw new Error('ide-overlay is requried');
    }

    const overlay = document.createElement('div');
    overlay.classList.add('terminal-hover-overlay');
    overlayContainer.appendChild(overlay);
    this.hoverOverlay = overlay;
  }

  private appendTerminalHoverContainer() {
    this.hoverWidget = document.createElement('div');
    this.hoverWidget.style.display = 'none';
    this.hoverWidget.style.position = 'fixed';
    this.hoverWidget.style.color = 'var(--editorWidget-foreground)';
    this.hoverWidget.style.backgroundColor = 'var(--editorWidget-background)';
    this.hoverWidget.style.borderColor = 'var(--editorWidget-border)';
    this.hoverWidget.style.borderWidth = '0.5px';
    this.hoverWidget.style.borderStyle = 'solid';
    this.hoverWidget.style.padding = '5px';
    this.hoverWidget.style.top = '-500px';
    this.hoverWidget.style.left = '-500px';
    this.hoverWidget.style.zIndex = '10';

    this.hoverWidget.classList.add('hover-container');
    if (!this.hoverOverlay) {
      this.appendTerminalHoverOverlay();
    }

    this.hoverOverlay?.appendChild(this.hoverWidget);
  }

  setHoverOverlay(overlay: HTMLElement) {
    this.hoverOverlay = overlay;
  }

  showHover(targetOptions: ILinkHoverTargetOptions, text: string, linkHandler: (url: string) => void) {
    if (!this.hoverWidget) {
      this.appendTerminalHoverContainer();
    }

    const viewportRange = targetOptions.viewportRange;
    const cellDimensions = targetOptions.cellDimensions;
    const boundingClientRect = targetOptions.boundingClientRect;

    if (this.hoverWidget) {
      this.hoverWidget.textContent = text;
      this.hoverWidget.style.display = 'inline';
    }

    // wait for the hover widget to be rendered
    requestAnimationFrame(() => {
      if (this.hoverWidget) {
        this.hoverWidget.style.top = `${
          (viewportRange.start.y - 1) * cellDimensions.height + boundingClientRect.y - TIPS_OFFSET_Y
        }px`;

        let tooltipsLeft = viewportRange.start.x * cellDimensions.width + boundingClientRect.x + TIPS_OFFSET_X;
        // if the tooltip is too close to the right edge of the terminal, move it to the left
        if (tooltipsLeft + this.hoverWidget.clientWidth > boundingClientRect.x + boundingClientRect.width) {
          tooltipsLeft = boundingClientRect.x + boundingClientRect.width - this.hoverWidget.clientWidth - TIPS_OFFSET_X;
        }

        this.hoverWidget.style.left = `${tooltipsLeft}px`;
      }
    });

    return Disposable.create(() => this.dispose());
  }

  hideHover() {
    if (this.hoverWidget) {
      this.dispose();
    }
  }

  dispose() {
    this.hoverWidget?.remove();
    this.hoverWidget = undefined;
  }
}
