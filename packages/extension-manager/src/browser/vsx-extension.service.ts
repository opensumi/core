import { observable } from 'mobx';
import { Injectable, Autowired } from '@ide-framework/common-di';
import { WorkbenchEditorService } from '@ide-framework/ide-editor/lib/browser';
import { debounce } from '@ide-framework/ide-core-common';
import { IStatusBarService, localize, StatusBarAlignment, StatusBarEntryAccessor, URI } from '@ide-framework/ide-core-browser';
import { ExtensionManagementService } from '@ide-framework/ide-kaitian-extension/lib/browser/extension-management.service';

import { IVSXExtensionBackService, IVSXExtensionService, VSXExtension, VSXExtensionServicePath } from '../common';
import { VSXExtensionRaw, VSXSearchParam, QueryParam } from '../common/vsx-registry-types';

@Injectable()
export class VSXExtensionService implements IVSXExtensionService {
  @Autowired(VSXExtensionServicePath)
  private readonly backService: IVSXExtensionBackService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired()
  protected extensionManagementService: ExtensionManagementService;

  @observable
  public extensions: VSXExtension[] = [];

  @Autowired(IStatusBarService)
  protected readonly statusBarService: IStatusBarService;

  private uploadStatus?: StatusBarEntryAccessor;

  @observable
  private tasks: Map<string, Promise<string>> = new Map();

  private updateStatusBar() {
    if (this.tasks.size === 0) {
      if (this.uploadStatus) {
        this.uploadStatus.dispose();
        this.uploadStatus = undefined;
      }
      return;
    }

    const entryId = 'kaitian-upload-file-status';
    if (this.tasks.size === 1) {
      const message = localize('marketplace.extension.installing');
      const entry = {
        text: message,
        alignment: StatusBarAlignment.RIGHT,
        tooltip: message,
        iconClass: 'kaitian-icon kticon-cloud-server',
      };
      this.uploadStatus = this.statusBarService.addElement(entryId, entry);
    }
  }

  async install(extension: VSXExtension): Promise<string | undefined> {
    const id = extension?.namespace?.toLowerCase() + '.' + extension?.name?.toLowerCase();
    if (this.tasks.has(id) || !extension.downloadUrl) {
      return;
    }

    const task = this.backService.install({
      id,
      name: extension.name!,
      url: extension.downloadUrl,
      version: extension.version!,
    });
    this.tasks.set(id, task);
    this.updateStatusBar();
    task.then((res) => {
      this.tasks.delete(id);
      this.updateStatusBar();
      this.extensionManagementService.postChangedExtension(false, res);
    });
    return task;
  }

  private asExtensionId(extension: VSXExtension) {
    return extension?.namespace?.toLowerCase() + '.' + extension?.name?.toLowerCase();
  }

  async getExtension(extensionId: string): Promise<VSXExtensionRaw | undefined> {
    const param: QueryParam = {
      extensionId,
    };

    const extension = this.extensions.find((e) => this.asExtensionId(e) === extensionId);

    const res = await this.backService.getExtension(param);
    if (res && res.extensions && res.extensions.length >= 1) {
      return Object.assign(extension || {}, res.extensions[0]);
    }
  }

  async openExtensionEditor(extensionId: string) {
    this.workbenchEditorService.open(new URI(`extension://?extensionId=${extensionId}`), { preview: true });
  }

  @debounce(500)
  async search(keyword: string): Promise<void> {
    const param: VSXSearchParam = {
      query: keyword,
    };

    const res = await this.backService.search(param);
    if (res.extensions) {
      this.extensions = res.extensions.map((ext) => ({
        ...ext,
        publisher: ext.namespace,
        iconUrl: ext.files.icon,
        downloadUrl: ext.files.download,
        readme: ext.files.readme,
      }));
    }
  }
}
