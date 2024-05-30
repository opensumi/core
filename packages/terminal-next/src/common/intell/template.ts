// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// 对源文件额外进行了面向对象 + 依赖注入的修改和优化，使其脱离 Node.js/Browser 单一环境的限制
// TemplateRunner 类,负责对于 Fig Template 的处理

import { Autowired, Injectable } from '@opensumi/di';

import { ITerminalIntellEnvironment } from './environment';

export interface ITemplateRunner {
  runTemplates(template: Fig.TemplateStrings[] | Fig.Template, cwd: string): Promise<Fig.TemplateSuggestion[]>;
}

export const ITemplateRunner = Symbol("TokenITemplateRunner");

/**
 * 解耦 FS 的依赖
 */
@Injectable()
export class TemplateRunner implements ITemplateRunner {
  @Autowired(ITerminalIntellEnvironment)
  protected terminalIntellEnv: ITerminalIntellEnvironment;

  getFileSystem() {
    return this.terminalIntellEnv.getFileSystem();
  }

  private async filepathsTemplate(cwd: string): Promise<Fig.TemplateSuggestion[]> {
    const fileSystem = await this.getFileSystem();
    const files = await fileSystem.readdir(cwd, { withFileTypes: true });
    return files
      .filter((f) => f.isFile() || f.isDirectory())
      .map((f) => ({
        name: f.name,
        priority: 55,
        context: { templateType: "filepaths" },
        type: f.isDirectory() ? "folder" : "file",
      }));
  }

  private async foldersTemplate(cwd: string): Promise<Fig.TemplateSuggestion[]> {
    const fileSystem = await this.getFileSystem();
    const files = await fileSystem.readdir(cwd, { withFileTypes: true });
    return files
      .filter((f) => f.isDirectory())
      .map((f) => ({
        name: f.name,
        priority: 55,
        context: { templateType: "folders" },
        type: "folder",
      }));
  }

  private historyTemplate(): Fig.TemplateSuggestion[] {
    return [];
  }

  private helpTemplate(): Fig.TemplateSuggestion[] {
    return [];
  }

  public async runTemplates(template: Fig.TemplateStrings[] | Fig.Template, cwd: string): Promise<Fig.TemplateSuggestion[]> {
    const templates = template instanceof Array ? template : [template];
    return (
      await Promise.all(
        templates.map(async (t) => {
          try {
            switch (t) {
              case "filepaths":
                return await this.filepathsTemplate(cwd);
              case "folders":
                return await this.foldersTemplate(cwd);
              case "history":
                return this.historyTemplate();
              case "help":
                return this.helpTemplate();
            }
          } catch (e) {
            this.terminalIntellEnv.getLogger().debug({ msg: "template failed", e, template: t, cwd });
            return [];
          }
        }),
      )
    ).flat();
  }
}
