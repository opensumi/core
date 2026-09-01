import path from 'path';

import * as React from 'react';
import ts from 'typescript';

import { COMMON_COMMANDS, fastdom } from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

jest.mock('tiktoken', () => ({
  Tiktoken: jest.fn(),
  get_encoding: jest.fn(),
}));

import { AINativeBrowserContribution } from '../../../src/browser/ai-core.contribution';
import { AI_CHAT_NEW_CHAT, AI_CHAT_NEW_TASK } from '../../../src/browser/chat/acp-new-draft.commands';
import { ChatInputRegistry } from '../../../src/browser/chat/chat.input.registry';

function getStrictFunctionTypeDiagnostics(sourceText: string): string[] {
  const fileName = path.resolve(__dirname, 'chat-input-registry.strict-contract.tsx');
  const compilerOptions: ts.CompilerOptions = {
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    experimentalDecorators: true,
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    strictFunctionTypes: true,
    target: ts.ScriptTarget.ES2018,
  };
  const host = ts.createCompilerHost(compilerOptions, true);
  const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (candidate) => path.resolve(candidate) === fileName || ts.sys.fileExists(candidate);
  host.readFile = (candidate) => (path.resolve(candidate) === fileName ? sourceText : ts.sys.readFile(candidate));
  host.getSourceFile = (candidate, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(candidate) === fileName
      ? ts.createSourceFile(candidate, sourceText, languageVersion, true, ts.ScriptKind.TSX)
      : getSourceFile(candidate, languageVersion, onError, shouldCreateNewSourceFile);

  const program = ts.createProgram([fileName], compilerOptions, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file?.fileName === fileName)
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (!diagnostic.file || diagnostic.start === undefined) {
        return message;
      }
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      return `${line + 1}:${character + 1} ${message}`;
    });
}

describe('ChatInputRegistry ACP turn capabilities', () => {
  it('accepts legacy components with required onSend under strictFunctionTypes', () => {
    const diagnostics = getStrictFunctionTypeDiagnostics(`
      import * as React from 'react';
      import {
        ChatInputRegistry,
        type IChatInputProps,
        type LegacyChatInputProps,
      } from '../../../src/browser/chat/chat.input.registry';

      type Assert<T extends true> = T;
      type IsRequired<T, K extends keyof T> = {} extends Pick<T, K> ? false : true;
      type OnSendRemainsRequired = Assert<IsRequired<LegacyChatInputProps, 'onSend'>>;
      type RequiredOnSendLegacyProps = Omit<IChatInputProps, 'onSend'> & {
        onSend: NonNullable<IChatInputProps['onSend']>;
      };

      const LegacyInput: React.ComponentType<RequiredOnSendLegacyProps> = () => React.createElement('div');
      const registry = new ChatInputRegistry();
      registry.registerChatInput({ id: 'legacy-required-on-send', component: LegacyInput });
      registry.setActiveInputHandle(null, 'legacy-required-on-send');
    `);

    expect(diagnostics).toEqual([]);
  });

  it('keeps a legacy input valid without new fields', () => {
    const registry = new ChatInputRegistry();
    const LegacyInput = () => React.createElement('div');
    registry.registerChatInput({ id: 'legacy', component: LegacyInput, priority: 10 });
    expect(registry.getActiveChatInput()).toMatchObject({ id: 'legacy', capabilities: [] });
  });

  it('rejects duplicate contribution ids with a deterministic error', () => {
    const registry = new ChatInputRegistry();
    const FirstInput = () => React.createElement('div');
    const DuplicateInput = () => React.createElement('div');
    registry.registerChatInput({ id: 'same', component: FirstInput });

    expect(() => registry.registerChatInput({ id: 'same', component: DuplicateInput })).toThrow(
      new Error('Chat input contribution id "same" is already registered.'),
    );
  });

  it('does not let a duplicate id replace the active contribution or its owned handle', () => {
    const registry = new ChatInputRegistry();
    const FirstInput = () => React.createElement('div');
    const DuplicateInput = () => React.createElement('div');
    const firstHandle = { focus: jest.fn() };
    registry.registerChatInput({ id: 'same', component: FirstInput, priority: 10 });
    registry.setActiveInputHandle(firstHandle, 'same');

    try {
      registry.registerChatInput({ id: 'same', component: DuplicateInput, priority: 20 });
    } catch {}

    expect(registry.getActiveChatInput()?.component).toBe(FirstInput);
    expect(registry.getActiveInputHandle()).toBe(firstHandle);
  });

  it('allows an id to be registered again after its contribution is disposed', () => {
    const registry = new ChatInputRegistry();
    const FirstInput = () => React.createElement('div');
    const ReplacementInput = () => React.createElement('div');
    const first = registry.registerChatInput({ id: 'same', component: FirstInput });

    first.dispose();
    registry.registerChatInput({ id: 'same', component: ReplacementInput });

    expect(registry.getActiveChatInput()?.component).toBe(ReplacementInput);
  });

  it('returns declared capabilities and a queued editor', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const QueuedEditor = () => React.createElement('div');
    registry.registerChatInput({
      id: 'rich',
      component: Input,
      queuedTurnEditor: QueuedEditor,
      capabilities: ['restore-draft', 'focus', 'expand', 'rich-queued-edit'],
      priority: 20,
    });
    expect(registry.getActiveChatInput()).toMatchObject({
      id: 'rich',
      queuedTurnEditor: QueuedEditor,
      capabilities: ['restore-draft', 'focus', 'expand', 'rich-queued-edit'],
    });
  });

  it('defensively copies declared capabilities', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const capabilities: Array<'restore-draft' | 'focus' | 'expand'> = ['restore-draft', 'focus'];
    registry.registerChatInput({ id: 'input', component: Input, capabilities });

    capabilities.push('expand');
    const contribution = registry.getActiveChatInput();
    expect(contribution?.capabilities).not.toBe(capabilities);
    expect(contribution?.capabilities).toEqual(['restore-draft', 'focus']);
  });

  it('does not expose registered contributions through the active lookup', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    registry.registerChatInput({ id: 'input', component: Input, capabilities: ['focus'], priority: 10 });

    const active = registry.getActiveChatInput();
    active!.id = 'mutated';
    active!.capabilities!.push('expand');

    expect(registry.getActiveChatInput()).toMatchObject({ id: 'input', capabilities: ['focus'] });
  });

  it('does not expose registered contributions through the contribution list', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    registry.registerChatInput({ id: 'input', component: Input, capabilities: ['focus'], priority: 10 });

    const contributions = registry.getChatInputContributions();
    contributions[0].priority = -1;
    contributions[0].capabilities!.push('expand');

    expect(registry.getChatInputContributions()[0]).toMatchObject({ priority: 10, capabilities: ['focus'] });
  });

  it('routes commands only to the currently mounted input handle', () => {
    const registry = new ChatInputRegistry();
    const firstHandle = { toggleExpanded: jest.fn() };
    const currentHandle = { focus: jest.fn() };
    registry.setActiveInputHandle(firstHandle);
    registry.setActiveInputHandle(currentHandle);
    expect(registry.getActiveInputHandle()).toBe(currentHandle);
    registry.setActiveInputHandle(null);
    expect(registry.getActiveInputHandle()).toBeNull();
  });

  it('focuses the active chat input through the registry seam', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const handle = { focus: jest.fn() };
    registry.registerChatInput({ id: 'active', component: Input, capabilities: ['focus'] });
    registry.setActiveInputHandle(handle, 'active');

    registry.focusActiveInput();

    expect(handle.focus).toHaveBeenCalledTimes(1);
  });

  it('honors a pending focus request when the active input mounts later', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const handle = { focus: jest.fn() };
    registry.registerChatInput({ id: 'active', component: Input, capabilities: ['focus'] });

    registry.focusActiveInput();
    registry.setActiveInputHandle(handle, 'active');

    expect(handle.focus).toHaveBeenCalledTimes(1);
  });

  it('reads and restores a complete draft through the mounted input handle', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const draft = {
      message: 'preserve me',
      images: ['data:image/png;base64,attachment'],
      agentId: 'agent-a',
      command: 'review',
    };
    const firstHandle = { getDraft: jest.fn(() => draft) };
    const secondHandle = { focus: jest.fn(), restoreDraft: jest.fn() };
    registry.registerChatInput({ id: 'active', component: Input, capabilities: ['restore-draft', 'focus'] });
    registry.setActiveInputHandle(firstHandle, 'active');

    expect(registry.preserveActiveDraft()).toEqual(draft);

    expect(firstHandle.getDraft).toHaveBeenCalledTimes(1);
    registry.setActiveInputHandle(null, 'active');
    registry.focusActiveInput();
    registry.setActiveInputHandle(secondHandle, 'active');
    registry.restoreActiveDraft(draft);
    expect(secondHandle.restoreDraft).toHaveBeenCalledWith(draft);
    expect(secondHandle.focus).toHaveBeenCalledTimes(1);
  });

  it('registers the expansion command against the current owner handle', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const staleHandle = { toggleExpanded: jest.fn() };
    const currentHandle = { toggleExpanded: jest.fn() };
    registry.registerChatInput({ id: 'active', component: Input, priority: 10 });
    registry.setActiveInputHandle(staleHandle, 'active');
    registry.setActiveInputHandle(currentHandle, 'active');

    const contribution = Object.create(AINativeBrowserContribution.prototype) as AINativeBrowserContribution;
    Object.defineProperty(contribution, 'chatInputRegistry', { configurable: true, value: registry });
    Object.defineProperty(contribution, 'panelLayoutService', {
      configurable: true,
      value: { isAgenticWorkbenchVisible: jest.fn(() => true) },
    });
    Object.defineProperty(contribution, 'mainLayoutService', { configurable: true, value: {} });

    let expansionHandler: { execute(): void } | undefined;
    const commands = {
      afterExecuteCommand: jest.fn(),
      beforeExecuteCommand: jest.fn(),
      registerCommand: jest.fn((command: { id: string }, handler: { execute(): void }) => {
        if (command.id === 'ai.chat.input.toggleExpanded') {
          expansionHandler = handler;
        }
      }),
    };

    contribution.registerCommands(commands as any);
    expansionHandler?.execute();

    expect(expansionHandler).toBeDefined();
    expect(staleHandle.toggleExpanded).not.toHaveBeenCalled();
    expect(currentHandle.toggleExpanded).toHaveBeenCalledTimes(1);
  });

  it('registers layout-specific New Chat and New Task commands against the shared draft seams', async () => {
    const registry = new ChatInputRegistry();
    const draft = { message: 'preserved draft', images: ['attachment'], agentId: 'agent-a', command: 'review' };
    const inputHandle = { focus: jest.fn(), getDraft: jest.fn(() => draft), restoreDraft: jest.fn() };
    registry.setActiveInputHandle(inputHandle);
    const contribution = Object.create(AINativeBrowserContribution.prototype) as AINativeBrowserContribution;
    const aiChatService = {
      enterDraftSession: jest.fn(),
      getInputDraft: jest.fn(() => undefined),
      updateInputDraft: jest.fn(),
    };
    const panelLayoutService = { showAIChatView: jest.fn() };
    const workspaceSwitch = { launchHeaderTask: jest.fn().mockResolvedValue({ status: 'launched' }) };
    Object.defineProperties(contribution, {
      aiChatService: { configurable: true, value: aiChatService },
      agenticWorkspaceSwitchService: { configurable: true, value: workspaceSwitch },
      chatInputRegistry: { configurable: true, value: registry },
      mainLayoutService: { configurable: true, value: {} },
      panelLayoutService: { configurable: true, value: panelLayoutService },
    });

    const handlers = new Map<string, { execute(agentId?: string): Promise<void> | void }>();
    const commands = {
      afterExecuteCommand: jest.fn(),
      beforeExecuteCommand: jest.fn(),
      registerCommand: jest.fn(
        (command: { id: string }, handler: { execute(agentId?: string): Promise<void> | void }) => {
          handlers.set(command.id, handler);
        },
      ),
    };

    contribution.registerCommands(commands as any);
    await handlers.get(AI_CHAT_NEW_CHAT.id)?.execute();

    expect(panelLayoutService.showAIChatView).toHaveBeenCalledTimes(1);
    expect(aiChatService.enterDraftSession).toHaveBeenCalledTimes(1);
    expect(inputHandle.restoreDraft).toHaveBeenCalledWith(draft);
    expect(inputHandle.focus).toHaveBeenCalledTimes(1);

    await handlers.get(AI_CHAT_NEW_TASK.id)?.execute('agent-b');

    expect(panelLayoutService.showAIChatView).toHaveBeenCalledTimes(2);
    expect(workspaceSwitch.launchHeaderTask).toHaveBeenCalledWith('agent-b');
    expect(inputHandle.restoreDraft).toHaveBeenCalledTimes(2);
    expect(inputHandle.focus).toHaveBeenCalledTimes(2);
  });

  it('retries draft focus across layout frames after revealing the chat view', async () => {
    const frameCallbacks: Array<() => void> = [];
    const measureAtNextFrame = jest.spyOn(fastdom, 'measureAtNextFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return { dispose: jest.fn() };
    });
    const registry = new ChatInputRegistry();
    const inputHandle = {
      focus: jest.fn(),
      isFocused: jest.fn(() => inputHandle.focus.mock.calls.length >= 3),
    };
    registry.setActiveInputHandle(inputHandle);
    const contribution = Object.create(AINativeBrowserContribution.prototype) as AINativeBrowserContribution;
    Object.defineProperties(contribution, {
      aiChatService: {
        configurable: true,
        value: {
          enterDraftSession: jest.fn(),
          getInputDraft: jest.fn(() => undefined),
          updateInputDraft: jest.fn(),
        },
      },
      chatInputRegistry: { configurable: true, value: registry },
      mainLayoutService: { configurable: true, value: {} },
      panelLayoutService: { configurable: true, value: { showAIChatView: jest.fn() } },
    });
    let newChatHandler: { execute(): void } | undefined;
    const commands = {
      afterExecuteCommand: jest.fn(),
      beforeExecuteCommand: jest.fn(),
      registerCommand: jest.fn((command: { id: string }, handler: { execute(): void }) => {
        if (command.id === AI_CHAT_NEW_CHAT.id) {
          newChatHandler = handler;
        }
      }),
    };

    contribution.registerCommands(commands as any);
    newChatHandler?.execute();

    expect(inputHandle.focus).toHaveBeenCalledTimes(1);
    expect(frameCallbacks).toHaveLength(1);
    frameCallbacks.shift()?.();
    expect(inputHandle.focus).toHaveBeenCalledTimes(2);
    expect(frameCallbacks).toHaveLength(1);
    frameCallbacks.shift()?.();
    expect(inputHandle.focus).toHaveBeenCalledTimes(3);
    expect(frameCallbacks).toHaveLength(0);

    measureAtNextFrame.mockRestore();
  });

  it('offers Agent Configuration when the New Task command has no available ACP Agent', async () => {
    const registry = new ChatInputRegistry();
    const inputHandle = { focus: jest.fn() };
    registry.setActiveInputHandle(inputHandle);
    const contribution = Object.create(AINativeBrowserContribution.prototype) as AINativeBrowserContribution;
    const configureLabel = 'Agent Configurations';
    const commandService = { executeCommand: jest.fn() };
    const messageService = { warning: jest.fn().mockResolvedValue(configureLabel) };
    const preferenceService = { get: jest.fn(() => ({})), set: jest.fn().mockResolvedValue(undefined) };
    const workspaceSwitch = { launchHeaderTask: jest.fn().mockResolvedValue({ status: 'no-agent' }) };
    Object.defineProperties(contribution, {
      aiChatService: {
        configurable: true,
        value: { getInputDraft: jest.fn(() => undefined), updateInputDraft: jest.fn() },
      },
      agenticWorkspaceSwitchService: { configurable: true, value: workspaceSwitch },
      chatInputRegistry: { configurable: true, value: registry },
      commandService: { configurable: true, value: commandService },
      mainLayoutService: { configurable: true, value: {} },
      messageService: { configurable: true, value: messageService },
      panelLayoutService: { configurable: true, value: { showAIChatView: jest.fn() } },
      preferenceService: { configurable: true, value: preferenceService },
    });
    let newTaskHandler: { execute(): Promise<void> } | undefined;
    const commands = {
      afterExecuteCommand: jest.fn(),
      beforeExecuteCommand: jest.fn(),
      registerCommand: jest.fn((command: { id: string }, handler: { execute(): Promise<void> }) => {
        if (command.id === AI_CHAT_NEW_TASK.id) {
          newTaskHandler = handler;
        }
      }),
    };

    contribution.registerCommands(commands as any);
    await newTaskHandler?.execute();

    expect(messageService.warning).toHaveBeenCalledWith('No ACP Agent available', [configureLabel], true);
    expect(preferenceService.set).toHaveBeenCalledWith(
      AINativeSettingSectionsId.AgentConfigs,
      expect.any(Object),
      expect.any(Number),
    );
    expect(commandService.executeCommand).toHaveBeenCalledWith(
      COMMON_COMMANDS.OPEN_PREFERENCES.id,
      AINativeSettingSectionsId.AgentConfigs,
    );
    expect(inputHandle.focus).not.toHaveBeenCalled();
  });

  it('registers one shared shortcut with mutually exclusive Classic and Agentic contexts', () => {
    const contribution = Object.create(AINativeBrowserContribution.prototype) as AINativeBrowserContribution;
    Object.defineProperties(contribution, {
      aiNativeConfigService: { configurable: true, value: { capabilities: { supportsAgentMode: true } } },
      inlineInputService: { configurable: true, value: { getInteractiveInputHandler: jest.fn() } },
    });
    const bindings: Array<{ command: string; keybinding: string; when?: string }> = [];
    const keybindings = {
      registerKeybinding: jest.fn((binding: { command: string; keybinding: string; when?: string }) => {
        bindings.push(binding);
        return { dispose: jest.fn() };
      }),
    };

    contribution.registerKeybindings(keybindings as any);

    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: AI_CHAT_NEW_CHAT.id,
          keybinding: 'ctrlcmd+alt+n',
          when: 'aiNative.panelLayout == classic',
        }),
        expect.objectContaining({
          command: AI_CHAT_NEW_TASK.id,
          keybinding: 'ctrlcmd+alt+n',
          when: 'aiNative.panelLayout == agentic',
        }),
      ]),
    );
  });

  it('rejects an owned handle from an inactive contribution', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const inactiveHandle = { focus: jest.fn() };
    registry.registerChatInput({ id: 'active', component: Input, priority: 20 });
    registry.registerChatInput({ id: 'inactive', component: Input, priority: 10 });

    registry.setActiveInputHandle(inactiveHandle, 'inactive');

    expect(registry.getActiveInputHandle()).toBeNull();
  });

  it('clears a stale handle when a higher-priority contribution becomes active', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const firstHandle = { focus: jest.fn() };
    registry.registerChatInput({ id: 'first', component: Input, priority: 10 });
    registry.setActiveInputHandle(firstHandle, 'first');

    registry.registerChatInput({ id: 'second', component: Input, priority: 20 });

    expect(registry.getActiveChatInput()?.id).toBe('second');
    expect(registry.getActiveInputHandle()).toBeNull();
  });

  it('does not let a delayed cleanup clear another contribution handle', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const currentHandle = { focus: jest.fn() };
    registry.registerChatInput({ id: 'first', component: Input, priority: 10 });
    registry.registerChatInput({ id: 'second', component: Input, priority: 20 });
    registry.setActiveInputHandle(currentHandle, 'second');

    registry.setActiveInputHandle(null, 'first');

    expect(registry.getActiveInputHandle()).toBe(currentHandle);
  });

  it('clears a disposed contribution handle when the previous contribution becomes active', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const currentHandle = { focus: jest.fn() };
    registry.registerChatInput({ id: 'first', component: Input, priority: 10 });
    const second = registry.registerChatInput({ id: 'second', component: Input, priority: 20 });
    registry.setActiveInputHandle(currentHandle, 'second');

    second.dispose();

    expect(registry.getActiveChatInput()?.id).toBe('first');
    expect(registry.getActiveInputHandle()).toBeNull();
  });

  it('clears a stale handle when a when condition changes the active contribution', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const firstHandle = { focus: jest.fn() };
    let secondEnabled = false;
    registry.registerChatInput({ id: 'first', component: Input, priority: 10 });
    registry.registerChatInput({
      id: 'second',
      component: Input,
      priority: 20,
      when: () => secondEnabled,
    });
    registry.setActiveInputHandle(firstHandle, 'first');

    secondEnabled = true;

    expect(registry.getActiveChatInput()?.id).toBe('second');
    expect(registry.getActiveInputHandle()).toBeNull();
  });
});
