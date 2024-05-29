// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// import fsAsync from "node:fs/promises";
import log from "../utils/log";

// 假文件信息
const fakeFiles = [
  {
    name: ".zsh_sessions",
    isFile: () => true,
    isDirectory: () => false,
  },
  {
    name: ".zshrc",
    isFile: () => true,
    isDirectory: () => false,
  },
  {
    name: "AlipayProjects",
    isFile: () => false,
    isDirectory: () => true,
  },
  {
    name: "Applications",
    isFile: () => false,
    isDirectory: () => true,
  },
  {
    name: "Desktop",
    isFile: () => false,
    isDirectory: () => true,
  },
  {
    name: "Documents",
    isFile: () => false,
    isDirectory: () => true,
  },
  {
    name: "Downloads",
    isFile: () => false,
    isDirectory: () => true,
  },
  {
    name: "Library",
    isFile: () => false,
    isDirectory: () => true,
  },
];

interface Dirent {
  /**
   * Returns `true` if the `fs.Dirent` object describes a regular file.
   * @since v10.10.0
   */
  isFile(): boolean;
  /**
   * Returns `true` if the `fs.Dirent` object describes a file system
   * directory.
   * @since v10.10.0
   */
  isDirectory(): boolean;
  name: string;
}

interface FSAsyncReadDir {
  readdir(cwd: string, options: { withFileTypes: true }): Promise<Dirent[]>;
}

class FSAsyncHack implements FSAsyncReadDir {
  private proxy: FSAsyncReadDir
  public async readdir(cwd: string, options: { withFileTypes: true }): Promise<Dirent[]> {
    if (!this.proxy) {
      return []
    } else return this.proxy.readdir(cwd, options)
  }
  setProxy(proxy: FSAsyncReadDir) {
    this.proxy = proxy;
  }
}

export const fsAsyncStub = new FSAsyncHack();

const filepathsTemplate = async (cwd: string): Promise<Fig.TemplateSuggestion[]> => {
  const files = await fsAsyncStub.readdir(cwd, { withFileTypes: true });
  return files.filter((f) => f.isFile() || f.isDirectory()).map((f) => ({ name: f.name, priority: 90, context: { templateType: "filepaths" } }));
};

const foldersTemplate = async (cwd: string): Promise<Fig.TemplateSuggestion[]> => {
  const files = await fsAsyncStub.readdir(cwd, { withFileTypes: true });
  return files.filter((f) => f.isDirectory()).map((f) => ({ name: f.name, priority: 90, context: { templateType: "folders" } }));
};

// TODO: implement history template
const historyTemplate = (): Fig.TemplateSuggestion[] => {
  return [];
};

// TODO: implement help template
const helpTemplate = (): Fig.TemplateSuggestion[] => {
  return [];
};

export const runTemplates = async (template: Fig.TemplateStrings[] | Fig.Template, cwd: string): Promise<Fig.TemplateSuggestion[]> => {
  const templates = template instanceof Array ? template : [template];
  return (
    await Promise.all(
      templates.map(async (t) => {
        try {
          switch (t) {
            case "filepaths":
              return await filepathsTemplate(cwd);
            case "folders":
              return await foldersTemplate(cwd);
            case "history":
              return historyTemplate();
            case "help":
              return helpTemplate();
          }
        } catch (e) {
          log.debug({ msg: "template failed", e, template: t, cwd });
          return [];
        }
      }),
    )
  ).flat();
};
