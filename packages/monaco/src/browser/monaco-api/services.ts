import { StaticServices } from '@ide-framework/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

/**
 * 基于 @ide-framework/monaco-editor-core@0.20.1-patch.19 版本
 * 可用的 services 均来自 https://github.com/opensumi/monaco-editor-core/blob/master/src/vs/editor/standalone/browser/standaloneServices.ts
 * 后续版本更新可能会有新增的内置 service
 */
export function createStaticServiceApi() {
  return Object.freeze({
    configurationService: StaticServices.configurationService.get(),
    resourceConfigurationService: StaticServices.resourceConfigurationService.get(),
    contextService: StaticServices.contextService.get(),
    labelService: StaticServices.labelService.get(),
    telemetryService: StaticServices.telemetryService.get(),
    /**
     * @deprecated
     * 不建议使用，内置的 DialogService 是浏览器原生 confirm 实现
     */
    dialogService: StaticServices.dialogService.get(),
    /**
     * @deprecated
     * 不建议使用，内置的 NotificationService 是空实现
     */
    notificationService: StaticServices.notificationService.get(),
    markerService: StaticServices.markerService.get(),
    modeService: StaticServices.modeService.get(),
    markerDecorationsService: StaticServices.markerDecorationsService.get(),
    standaloneThemeService: StaticServices.standaloneThemeService.get(),
    logService: StaticServices.logService.get(),
    modelService: StaticServices.modelService.get(),
    codeEditorService: StaticServices.codeEditorService.get(),
    editorProgressService: StaticServices.editorProgressService.get(),
    storageService: StaticServices.storageService.get(),
    editorWorkerService: StaticServices.editorWorkerService.get(),
  });
}

export {
  StaticServices,
};
