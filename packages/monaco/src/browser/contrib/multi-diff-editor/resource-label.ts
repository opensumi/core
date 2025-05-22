import { URI, Uri, getResourceIconClass } from '@opensumi/ide-core-browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IResourceLabelOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/multiDiffEditor/workbenchUIElementFactory';

import styles from './resource-label.module.less';

export class ResourceLabel {
  constructor(private readonly element: HTMLElement) {}

  setUri(uri: Uri, workspaceService: IWorkspaceService, options?: IResourceLabelOptions) {
    this.renderFile(URI.from(uri), workspaceService, options);
  }

  private renderFile(uri: URI, workspace: IWorkspaceService, options?: IResourceLabelOptions) {
    const icon = getResourceIconClass(uri);
    workspace.asRelativePath(uri).then((relativePath) => {
      const pathWithoutFileName = relativePath?.path
        ? relativePath.path.substring(0, relativePath.path.lastIndexOf('/'))
        : '';

      const relativePathElement = pathWithoutFileName
        ? `<span class="${styles.relativePath} ${styles.ellipsisPath}">${pathWithoutFileName}</span>`
        : '';

      this.element.innerHTML = `<span class="${styles.resourceLabel}${
        options?.strikethrough ? ` ${styles.strikethrough}` : ''
      }"><span class="${icon.iconClass}"></span>${uri.displayName}${relativePathElement}</span>`;
    });
  }

  clear() {
    this.element.innerHTML = '';
  }
}
