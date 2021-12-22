import { Injectable } from '@opensumi/di';
import { ITerminalHoverManagerService, ITerminalGroupViewService, ITerminalController } from '../common';
import { ILinkHoverTargetOptions } from './links/link-manager';

const TIPS_OFFSET_Y = 20;
const TIPS_OFFSET_X = 5;

@Injectable()
export class TerminalHoverManagerService implements ITerminalHoverManagerService {
  hoverWidget: HTMLElement | undefined;

  private appendTerminalHoverContainer() {
    const overlayContainer = document.querySelector('#ide-overlay');

    if (!overlayContainer) {
      throw new Error('ide-overlay is requried');
    }

    const overlay = document.createElement('div');
    overlay.classList.add('terminal-hover-overlay');
    overlayContainer.appendChild(overlay);

    this.hoverWidget = document.createElement('div');
    this.hoverWidget.style.display = 'none';
    this.hoverWidget.style.position = 'fixed';
    this.hoverWidget.style.color = 'var(--editorWidget-foreground)';
    this.hoverWidget.style.backgroundColor = 'var(--editorWidget-background)';
    this.hoverWidget.style.borderColor = 'var(--editorWidget-border)';
    this.hoverWidget.style.borderWidth = '0.5px';
    this.hoverWidget.style.borderStyle = 'solid';
    this.hoverWidget.style.padding = '5px';
    this.hoverWidget.style.zIndex = '10';

    this.hoverWidget.classList.add('hover-container');
    overlay.appendChild(this.hoverWidget);
  }

  showHover(targetOptions: ILinkHoverTargetOptions, text: string, linkHandler: (url: string) => void) {
    if (!this.hoverWidget) {
      this.appendTerminalHoverContainer();
    }

    const viewportRange = targetOptions.viewportRange;
    const cellDimensions = targetOptions.cellDimensions;
    const boundingClientRect = targetOptions.boundingClientRect;

    if (this.hoverWidget) {
      this.hoverWidget.style.top = `${
        (viewportRange.start.y - 1) * cellDimensions.height + boundingClientRect.y - TIPS_OFFSET_Y
      }px`;
      this.hoverWidget.style.left = `${
        viewportRange.start.x * cellDimensions.width + boundingClientRect.x + TIPS_OFFSET_X
      }px`;
      this.hoverWidget.style.display = 'inline';
      this.hoverWidget.textContent = text;
    }

    return {
      dispose: () => {
        this.dispose();
      },
    };
  }

  hideHover() {
    if (this.hoverWidget) {
      this.hoverWidget.style.display = 'none';
    }
  }

  dispose() {
    this.hoverWidget?.remove();
    this.hoverWidget = undefined;
  }
}
