import { URI, Uri, getResourceIconClass } from '@opensumi/ide-core-browser';
import { IResourceLabelOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/multiDiffEditor/workbenchUIElementFactory';

import styles from './resource-label.module.less';

export class ResourceLabel {
  constructor(private readonly element: HTMLElement) {}

  setUri(uri: Uri, options?: IResourceLabelOptions) {
    this.renderFile(URI.from(uri), options);
  }

  private renderFile(uri: URI, options?: IResourceLabelOptions) {
    const icon = getResourceIconClass(uri);
    this.element.innerHTML = `<span class="${styles.resourceLabel}${
      options?.strikethrough ? ' strikethrough' : ''
    }"><span class="${icon.iconClass}"></span>${uri.displayName}</span>`;
  }

  clear() {
    this.element.innerHTML = '';
  }
}
