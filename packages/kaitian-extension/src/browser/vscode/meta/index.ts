import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { VSCodeContributeRunner } from './contributes';
import { IExtension } from '../../../common';
import { Disposable, ILogger } from '@ali/ide-core-browser';
import { ActivationEventService } from '@ali/ide-activation-event';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileSearchServicePath, IFileSearchService } from '@ali/ide-search/lib/common';
import { getLogger } from '@ali/ide-core-browser';

@Injectable({multiple: true})
export class VSCodeMetaService extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired()
  private activationService: ActivationEventService;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(FileSearchServicePath)
  private fileSearchService: IFileSearchService;

  @Autowired(ILogger)
  logger: ILogger;

  public async run(extension: IExtension) {
    try {
      const runner = this.injector.get(VSCodeContributeRunner, [extension]);
      await runner.run();
      await this.registerActivationEvent(extension);
      await this.activateByWorkspaceContains(extension);
    } catch (e) {
      this.logger.error('vscode meta启用插件出错' + extension.name);
      this.logger.error(e);
    }
  }

  private registerActivationEvent(extension: IExtension) {
    const { activationEvents = [] } = extension.packageJSON;
    const activateDisposer = new Disposable();

    // FIXME: 这块目前沿用 vscode 的激活启动方式，考虑是否扩展部分有独立设置
    activationEvents.forEach((event) => {
      this.activationService.onEvent(event, async () => {
        await extension.activate();
        activateDisposer.dispose();
      });
    });
  }

  private async activateByWorkspaceContains(extension: IExtension) {
    const { activationEvents = [] } = extension.packageJSON;

    const paths: string[] = [];
    const includePatterns: string[] = [];
    for (const activationEvent of activationEvents) {
      if (/^workspaceContains:/.test(activationEvent)) {
        const fileNameOrGlob = activationEvent.substr('workspaceContains:'.length);
        if (fileNameOrGlob.indexOf('*') >= 0 || fileNameOrGlob.indexOf('?') >= 0) {
          includePatterns.push(fileNameOrGlob);
        } else {
          paths.push(fileNameOrGlob);
        }
      }
    }

    const promises: Promise<boolean>[] = [];
    if (paths.length) {
      promises.push(this.workspaceService.containsSome(paths));
    }

    if (includePatterns.length) {
      promises.push((async () => {
        try {
          const result = await this.fileSearchService.find('', {
            rootUris: this.workspaceService.tryGetRoots().map((r) => r.uri),
            includePatterns,
            limit: 1,
          });
          return result.length > 0;
        } catch (e) {
          getLogger().error(e);
          return false;
        }
      })());
    }

    if (promises.length && await Promise.all(promises).then((exists) => exists.some((v) => v))) {
      this.activationService.fireEvent('workspaceContains', [...paths, ...includePatterns][0]);
    }
  }

}
