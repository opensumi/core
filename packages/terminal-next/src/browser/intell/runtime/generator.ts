// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import log from "../utils/log";
import { runTemplates } from "./template";
// import { buildExecuteShellCommand } from "./utils.js";

const getGeneratorContext = (cwd: string): Fig.GeneratorContext => {
  return {
    environmentVariables: Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] != null)),
    currentWorkingDirectory: cwd,
    currentProcess: "", // TODO: define current process
    sshPrefix: "", // deprecated, should be empty
    isDangerous: false,
    searchTerm: "", // TODO: define search term
  };
};

const buildExecuteShellCommand = (args: any): any => {
  console.error("buildExecuteShellCommand not implemented", args);
  // throw new Error("Function not implemented.");
  return (shellInput: any) => {
    console.log('shellInput', shellInput);
    return {
      stdout: ''
    }
  }
}

// TODO: add support for caching, trigger, & getQueryTerm
export const runGenerator = async (generator: Fig.Generator, tokens: string[], cwd: string): Promise<Fig.Suggestion[]> => {
  // TODO: support trigger
  const { script, postProcess, scriptTimeout, splitOn, custom, template, filterTemplateSuggestions } = generator;
  console.log("runGenerator", { script, postProcess, scriptTimeout, splitOn, custom, template, filterTemplateSuggestions });

  const executeShellCommand = buildExecuteShellCommand(scriptTimeout ?? 5000);
  const suggestions = [];
  try {
    if (script) {
      const shellInput = typeof script === "function" ? script(tokens) : script;
      const scriptOutput = Array.isArray(shellInput)
        ? await executeShellCommand({ command: shellInput.at(0) ?? "", args: shellInput.slice(1) })
        : await executeShellCommand(shellInput);

      if (postProcess) {
        const postProcessSuggestions = postProcess(scriptOutput.stdout, tokens);
        suggestions.push(...postProcessSuggestions);
      } else if (splitOn) {
        const splitSuggestions = scriptOutput.stdout.split(splitOn).map((s) => ({ name: s }));
        suggestions.push(...splitSuggestions);
      }
    }

    if (custom) {
      const customSuggestions = await custom(tokens, executeShellCommand, getGeneratorContext(cwd));
      suggestions.push(...customSuggestions);
    }

    if (template != null) {
      const templateSuggestions = await runTemplates(template, cwd);
      if (filterTemplateSuggestions) {
        const filteredSuggestions = filterTemplateSuggestions(templateSuggestions);
        suggestions.push(...filteredSuggestions);
      } else {
        suggestions.push(...templateSuggestions);
      }
    }
    return suggestions;
  } catch (e) {
    log.debug({ msg: "generator failed", e, script, splitOn, template });
  }
  return suggestions;
};
