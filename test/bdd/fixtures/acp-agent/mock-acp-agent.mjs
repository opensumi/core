#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';

import { AgentSideConnection, RequestError, ndJsonStream } from '@agentclientprotocol/sdk';

const DEFAULT_DELAY_MS = 40;
const DEFAULT_LONG_STREAM_TICKS = 80;
const PROCESS_EXIT_FIXTURE_CODE = 17;
const TASK_SESSION_MISSING_EXIT_CODE = 18;

function parseArgs(argv) {
  const options = {
    fixture: process.env.OPENSUMI_ACP_BDD_FIXTURE || 'stream-rich',
    delayMs: Number(process.env.OPENSUMI_ACP_BDD_DELAY_MS || DEFAULT_DELAY_MS),
    longStreamTicks: Number(process.env.OPENSUMI_ACP_BDD_LONG_STREAM_TICKS || DEFAULT_LONG_STREAM_TICKS),
    historyMessageCount: Number(process.env.OPENSUMI_ACP_BDD_HISTORY_MESSAGE_COUNT || 0),
    sessionPrefix: process.env.OPENSUMI_ACP_BDD_SESSION_PREFIX || 'bdd-session',
    verbose: process.env.OPENSUMI_ACP_BDD_VERBOSE === '1',
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--fixture') {
      options.fixture = argv[++i] || options.fixture;
    } else if (arg.startsWith('--fixture=')) {
      options.fixture = arg.slice('--fixture='.length);
    } else if (arg === '--delay-ms') {
      options.delayMs = Number(argv[++i] || options.delayMs);
    } else if (arg.startsWith('--delay-ms=')) {
      options.delayMs = Number(arg.slice('--delay-ms='.length));
    } else if (arg === '--long-stream-ticks') {
      options.longStreamTicks = Number(argv[++i] || options.longStreamTicks);
    } else if (arg.startsWith('--long-stream-ticks=')) {
      options.longStreamTicks = Number(arg.slice('--long-stream-ticks='.length));
    } else if (arg === '--history-message-count') {
      options.historyMessageCount = Number(argv[++i] || options.historyMessageCount);
    } else if (arg.startsWith('--history-message-count=')) {
      options.historyMessageCount = Number(arg.slice('--history-message-count='.length));
    } else if (arg === '--session-prefix') {
      options.sessionPrefix = argv[++i] || options.sessionPrefix;
    } else if (arg.startsWith('--session-prefix=')) {
      options.sessionPrefix = arg.slice('--session-prefix='.length);
    } else if (arg === '--verbose') {
      options.verbose = true;
    }
  }

  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    options.delayMs = DEFAULT_DELAY_MS;
  }
  if (!Number.isFinite(options.longStreamTicks) || options.longStreamTicks < 1) {
    options.longStreamTicks = DEFAULT_LONG_STREAM_TICKS;
  }
  if (!Number.isInteger(options.historyMessageCount) || options.historyMessageCount < 0) {
    options.historyMessageCount = 0;
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  console.log(`OpenSumi BDD mock ACP agent

Usage:
  node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs [--fixture stream-rich]

Options:
  --fixture <name>          Fixture mode. Also accepts OPENSUMI_ACP_BDD_FIXTURE.
  --delay-ms <ms>          Delay between streamed updates.
  --long-stream-ticks <n>  Number of long-stream chunks before natural completion.
  --history-message-count <n> Number of visible messages seeded for each history session.
  --session-prefix <text>  Prefix for generated session ids.
  --verbose                Write diagnostics to stderr.

Fixtures:
  stream-rich       Content, thought, plan, tool call, config, and usage updates.
  long-stream       Repeated content chunks until session/cancel or tick limit.
  permission        Requests visible client permission during prompt.
  send-failure      Fails deterministically during session/prompt.
  service-failure   Returns the generic OpenCode service failure shape.
  model-not-found   Returns an invalid-model JSON-RPC error with model metadata.
  create-failure    Fails deterministically during session/new.
  load-failure      Fails deterministically during session/load.
  list-failure      Fails deterministically during session/list.
  task-session-missing Completes a Task, exits, then reports its Session missing after restart.
  auth-required     Raises an ACP auth-required error during session/prompt.
  config-failure    Fails deterministic session/set_config_option calls.
  process-exit      Emits prompt updates, then exits the ACP agent process.
  history           Seeds deterministic list/load session metadata and bounded rich replay updates.
  file-link         Emits deterministic assistant markdown with file-link cases.
`);
  process.exit(0);
}

const log = (...args) => {
  if (options.verbose) {
    console.error('[mock-acp-agent]', ...args);
  }
};

const sleep = (ms = options.delayMs) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const text = (value) => ({ type: 'text', text: value });

function createConfigOptions(state = {}) {
  const values = {
    mode: state.mode || 'agent',
    model: state.model || 'bdd-small',
    thought: state.thought || 'medium',
    webSearch: state.webSearch ?? false,
  };

  return [
    {
      id: 'bdd-mode',
      name: 'BDD Mode',
      type: 'select',
      category: 'mode',
      currentValue: values.mode,
      options: [
        { value: 'agent', name: 'Agent' },
        { value: 'chat', name: 'Chat' },
      ],
    },
    {
      id: 'bdd-model',
      name: 'BDD Model',
      type: 'select',
      category: 'model',
      currentValue: values.model,
      options: [
        { value: 'bdd-small', name: 'BDD Small' },
        { value: 'bdd-large', name: 'BDD Large' },
      ],
    },
    {
      id: 'bdd-thought-level',
      name: 'BDD Thought Level',
      type: 'select',
      category: 'thought_level',
      currentValue: values.thought,
      options: [
        { value: 'low', name: 'Low' },
        { value: 'medium', name: 'Medium' },
        { value: 'high', name: 'High' },
      ],
    },
    {
      id: 'bdd-web-search',
      name: 'BDD Web Search',
      type: 'boolean',
      category: '_bdd_feature',
      currentValue: values.webSearch,
    },
  ];
}

function createModes(currentModeId = 'agent') {
  return {
    currentModeId,
    availableModes: [
      { id: 'agent', name: 'Agent', description: 'Deterministic agent mode' },
      { id: 'chat', name: 'Chat', description: 'Deterministic chat mode' },
    ],
  };
}

function createModels(currentModelId = 'bdd-small') {
  return {
    currentModelId,
    availableModels: [
      { modelId: 'bdd-small', name: 'BDD Small', description: 'Fast deterministic model' },
      { modelId: 'bdd-large', name: 'BDD Large', description: 'Verbose deterministic model' },
    ],
  };
}

function createCommands() {
  return [
    {
      name: 'bdd_echo',
      description: 'Emit a deterministic assistant response.',
      input: { hint: 'optional deterministic text' },
    },
    {
      name: 'bdd_plan',
      description: 'Emit deterministic thought, plan, and tool updates.',
      input: { hint: 'optional plan subject' },
    },
    {
      name: 'bdd_permission',
      description: 'Trigger a deterministic permission request.',
      input: { hint: 'optional permission subject' },
    },
  ];
}

function createSessionRecord(sessionId, cwd) {
  return {
    sessionId,
    cwd,
    title: `BDD Session ${sessionId}`,
    updatedAt: nowIso(),
    mode: 'agent',
    model: 'bdd-small',
    thought: 'medium',
    webSearch: false,
    promptCount: 0,
  };
}

function createHistorySessionRecord(sessionId, cwd, seed, updatedAt) {
  const session = createSessionRecord(sessionId, cwd);
  session.title = `BDD History ${seed}`;
  session.updatedAt = updatedAt;
  session.historySeed = seed;
  session.promptCount = 1;
  return session;
}

function responseForSession(session) {
  return {
    sessionId: session.sessionId,
    modes: createModes(session.mode),
    models: createModels(session.model),
    configOptions: createConfigOptions(session),
  };
}

function sessionInfo(session) {
  return {
    sessionId: session.sessionId,
    cwd: session.cwd,
    title: session.title,
    updatedAt: session.updatedAt,
  };
}

function extractPromptText(prompt) {
  if (!Array.isArray(prompt)) {
    return '';
  }
  return prompt
    .map((block) => {
      if (block?.type === 'text') {
        return block.text || '';
      }
      if (block?.type === 'resource_link') {
        return block.title || block.name || block.uri || '';
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function createAgent(conn) {
  const sessions = new Map();
  const pendingPrompts = new Map();
  let nextSessionNumber = 1;
  let historySeedCwd;

  const usesSharedSessionStore = options.fixture === 'history' || options.fixture === 'load-failure';
  const sessionStorePath = (cwd) =>
    path.join(
      cwd,
      '.sumi',
      `acp-bdd-sessions-${options.sessionPrefix.replace(/[^a-z0-9_-]+/gi, '-')}.json`,
    );
  const readSessionStore = (cwd) => {
    if (!usesSharedSessionStore || !cwd) {
      return [];
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(sessionStorePath(cwd), 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const loadSessionStore = (cwd) => {
    if (!usesSharedSessionStore || !cwd) {
      return;
    }
    for (const session of readSessionStore(cwd)) {
      if (session?.sessionId) {
        sessions.set(session.sessionId, session);
      }
    }
  };
  const persistSessionStore = (cwd) => {
    if (!usesSharedSessionStore || !cwd) {
      return;
    }
    const merged = new Map(readSessionStore(cwd).map((session) => [session.sessionId, session]));
    for (const session of sessions.values()) {
      if (session.cwd === cwd) {
        merged.set(session.sessionId, session);
      }
    }
    fs.mkdirSync(path.dirname(sessionStorePath(cwd)), { recursive: true });
    fs.writeFileSync(sessionStorePath(cwd), `${JSON.stringify([...merged.values()], null, 2)}\n`, 'utf8');
  };

  if (options.fixture === 'history' || options.fixture === 'load-failure') {
    const seeds = [
      { suffix: 'alpha', updatedAt: '2026-06-11T00:00:01.000Z' },
      { suffix: 'beta', updatedAt: '2026-06-11T00:00:02.000Z' },
    ];

    for (const { suffix, updatedAt } of seeds) {
      const session = createHistorySessionRecord(
        `${options.sessionPrefix}-${suffix}`,
        process.cwd(),
        suffix,
        updatedAt,
      );
      sessions.set(session.sessionId, session);
    }
  }

  const emit = async (sessionId, update) => {
    await conn.sessionUpdate({ sessionId, update });
  };

  const emitAvailableCommandsUpdate = async (session) => {
    await emit(session.sessionId, {
      sessionUpdate: 'available_commands_update',
      availableCommands: createCommands(),
    });
  };

  const scheduleAvailableCommandsUpdate = (session) => {
    setTimeout(() => {
      emitAvailableCommandsUpdate(session).catch((error) => log('available commands update failed', error));
    }, 0);
  };

  const emitInitialSessionUpdates = async (session) => {
    await emit(session.sessionId, {
      sessionUpdate: 'session_info_update',
      title: session.title,
      updatedAt: session.updatedAt,
    });
    await emitAvailableCommandsUpdate(session);
    await emit(session.sessionId, {
      sessionUpdate: 'current_mode_update',
      currentModeId: session.mode,
    });
    await emit(session.sessionId, {
      sessionUpdate: 'config_option_update',
      configOptions: createConfigOptions(session),
    });
  };

  const getOrCreateSession = (sessionId, cwd = process.cwd()) => {
    if (sessions.has(sessionId)) {
      return sessions.get(sessionId);
    }
    const session = createSessionRecord(sessionId, cwd);
    sessions.set(sessionId, session);
    return session;
  };

  const runRichStream = async (session, promptText) => {
    const configSnapshot = {
      mode: session.mode,
      model: session.model,
      thought: session.thought,
      webSearch: session.webSearch,
    };

    await emit(session.sessionId, {
      sessionUpdate: 'agent_thought_chunk',
      content: text('BDD_THOUGHT_STEP_1: inspected deterministic fixture.'),
    });
    await emit(session.sessionId, {
      sessionUpdate: 'agent_thought_chunk',
      content: text(
        `BDD_CONFIG_SNAPSHOT mode=${configSnapshot.mode} model=${configSnapshot.model} thought=${configSnapshot.thought} webSearch=${configSnapshot.webSearch}`,
      ),
    });
    await sleep();
    await emit(session.sessionId, {
      sessionUpdate: 'plan',
      entries: [
        { content: 'BDD plan: prepare deterministic stream', status: 'completed', priority: 'high' },
        { content: 'BDD plan: emit tool update', status: 'in_progress', priority: 'medium' },
      ],
    });
    await sleep();
    await emit(session.sessionId, {
      sessionUpdate: 'agent_message_chunk',
      content: text(`BDD_ASSISTANT_PART_1 for turn ${session.promptCount}.`),
    });
    await sleep();
    await emit(session.sessionId, {
      sessionUpdate: 'tool_call',
      toolCallId: `bdd-tool-${session.promptCount}`,
      title: 'BDD deterministic tool',
      kind: 'read',
      status: 'pending',
      rawInput: {
        fixture: options.fixture,
        promptChars: promptText.length,
        configSnapshot,
      },
    });
    await sleep();
    await emit(session.sessionId, {
      sessionUpdate: 'tool_call_update',
      toolCallId: `bdd-tool-${session.promptCount}`,
      status: 'in_progress',
      rawInput: {
        fixture: options.fixture,
        phase: 'in_progress',
      },
    });
    await sleep();
    await emit(session.sessionId, {
      sessionUpdate: 'tool_call_update',
      toolCallId: `bdd-tool-${session.promptCount}`,
      status: 'completed',
      rawOutput: {
        ok: true,
        sentinel: 'BDD_TOOL_RESULT',
      },
    });
    await sleep();
    await emit(session.sessionId, {
      sessionUpdate: 'agent_message_chunk',
      content: text(' BDD_ASSISTANT_PART_2 completed.'),
    });
    await emit(session.sessionId, {
      sessionUpdate: 'usage_update',
      size: 4096,
      used: 128 + session.promptCount,
    });
  };

  const emitHistoryReplay = async (session) => {
    if (options.fixture !== 'history' || !session.historySeed) {
      return;
    }

    const seed = String(session.historySeed);
    const upperSeed = seed.toUpperCase();
    const toolCallId = `bdd-history-${seed}-tool`;
    const restoredDynamicSession = seed === 'restored';
    const userContent = restoredDynamicSession ? 'Restored Task context' : `BDD_HISTORY_USER_${upperSeed}`;
    const thoughtContent = restoredDynamicSession
      ? 'Restored deterministic reasoning.'
      : `BDD_HISTORY_THOUGHT_${upperSeed}: deterministic replay.`;
    const assistantPartOne = restoredDynamicSession
      ? 'Restored Task response, part one.'
      : `BDD_HISTORY_ASSISTANT_${upperSeed}_PART_1.`;
    const assistantPartTwo = restoredDynamicSession
      ? ' Restored Task response, part two.'
      : ` BDD_HISTORY_ASSISTANT_${upperSeed}_PART_2.`;

    if (options.historyMessageCount > 0) {
      for (let index = 0; index < options.historyMessageCount; index++) {
        const turn = Math.floor(index / 2);
        if (index % 2 === 0) {
          await emit(session.sessionId, {
            sessionUpdate: 'user_message_chunk',
            content: text(`BDD_LONG_HISTORY_${upperSeed}_USER_${turn}`),
          });
          continue;
        }
        if (turn % 25 === 0) {
          const longToolCallId = `bdd-long-history-${seed}-${turn}`;
          await emit(session.sessionId, {
            sessionUpdate: 'agent_thought_chunk',
            content: text(`BDD_LONG_HISTORY_${upperSeed}_THOUGHT_${turn}: inspect the retained context.`),
          });
          await emit(session.sessionId, {
            sessionUpdate: 'plan',
            entries: [
              { content: `Review long-history turn ${turn}`, status: 'completed', priority: 'medium' },
              { content: `Render long-history turn ${turn}`, status: 'in_progress', priority: 'high' },
            ],
          });
          await emit(session.sessionId, {
            sessionUpdate: 'tool_call',
            toolCallId: longToolCallId,
            title: `BDD long-history tool ${turn}`,
            kind: 'read',
            status: 'completed',
            rawInput: { fixture: 'history', seed, turn },
            rawOutput: { ok: true, sentinel: `BDD_LONG_HISTORY_${upperSeed}_TOOL_${turn}` },
          });
        }
        await emit(session.sessionId, {
          sessionUpdate: 'agent_message_chunk',
          content: text(
            turn % 20 === 0
              ? `BDD_LONG_HISTORY_${upperSeed}_ASSISTANT_${turn}\n\n- mixed Markdown row\n- stable message identity`
              : `BDD_LONG_HISTORY_${upperSeed}_ASSISTANT_${turn}`,
          ),
        });
      }
      return;
    }

    await emit(session.sessionId, {
      sessionUpdate: 'user_message_chunk',
      content: text(userContent),
    });
    await emit(session.sessionId, {
      sessionUpdate: 'agent_thought_chunk',
      content: text(thoughtContent),
    });
    await emit(session.sessionId, {
      sessionUpdate: 'plan',
      entries: [
        { content: `BDD history ${seed}: restore session`, status: 'completed', priority: 'high' },
        { content: `BDD history ${seed}: keep replay bounded`, status: 'completed', priority: 'medium' },
      ],
    });
    await emit(session.sessionId, {
      sessionUpdate: 'agent_message_chunk',
      content: text(assistantPartOne),
    });
    await emit(session.sessionId, {
      sessionUpdate: 'tool_call',
      toolCallId,
      title: 'BDD history deterministic tool',
      kind: 'read',
      status: 'pending',
      rawInput: {
        fixture: 'history',
        sessionSeed: seed,
        bounded: true,
      },
    });
    await emit(session.sessionId, {
      sessionUpdate: 'tool_call_update',
      toolCallId,
      status: 'completed',
      rawOutput: {
        ok: true,
        sentinel: 'BDD_HISTORY_TOOL_RESULT',
        sessionSeed: seed,
      },
    });
    await emit(session.sessionId, {
      sessionUpdate: 'agent_message_chunk',
      content: text(assistantPartTwo),
    });
    await emit(session.sessionId, {
      sessionUpdate: 'usage_update',
      size: 2048,
      used: 96,
    });
  };

  const runLongStream = async (session) => {
    let resolveCancel;
    const cancelPromise = new Promise((resolve) => {
      resolveCancel = resolve;
    });
    pendingPrompts.set(session.sessionId, { cancel: resolveCancel });

    try {
      for (let i = 1; i <= options.longStreamTicks; i++) {
        await emit(session.sessionId, {
          sessionUpdate: 'agent_message_chunk',
          content: text(`BDD_LONG_STREAM_CHUNK_${String(i).padStart(2, '0')} `),
        });

        const canceled = await Promise.race([sleep(), cancelPromise.then(() => true)]);
        if (canceled === true) {
          await emit(session.sessionId, {
            sessionUpdate: 'agent_message_chunk',
            content: text('BDD_LONG_STREAM_CANCELLED'),
          });
          return { stopReason: 'cancelled' };
        }
      }
    } finally {
      pendingPrompts.delete(session.sessionId);
    }

    return { stopReason: 'end_turn' };
  };

  const runPermission = async (session) => {
    const toolCallId = `bdd-permission-${session.promptCount}`;
    const toolCall = {
      toolCallId,
      title: 'BDD permission fixture',
      kind: 'edit',
      status: 'pending',
      rawInput: {
        fixture: 'permission',
        path: 'editor.js',
      },
    };

    await emit(session.sessionId, { sessionUpdate: 'tool_call', ...toolCall });
    const response = await conn.requestPermission({
      sessionId: session.sessionId,
      toolCall,
      options: [
        { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
        { optionId: 'reject_once', name: 'Reject', kind: 'reject_once' },
      ],
    });

    const selected = response?.outcome?.outcome === 'selected' ? response.outcome.optionId : 'cancelled';
    const allowed = selected === 'allow_once';

    await emit(session.sessionId, {
      sessionUpdate: 'tool_call_update',
      toolCallId,
      status: allowed ? 'completed' : 'failed',
      rawOutput: {
        permissionOutcome: selected,
      },
    });
    await emit(session.sessionId, {
      sessionUpdate: 'agent_message_chunk',
      content: text(allowed ? 'BDD_PERMISSION_ALLOWED' : 'BDD_PERMISSION_REJECTED'),
    });

    return { stopReason: allowed ? 'end_turn' : 'cancelled' };
  };

  const runProcessExit = async (session) => {
    await emit(session.sessionId, {
      sessionUpdate: 'agent_thought_chunk',
      content: text('BDD_PARTIAL_THOUGHT: prepared deterministic partial turn.'),
    });
    await emit(session.sessionId, {
      sessionUpdate: 'agent_message_chunk',
      content: text('BDD_ASSISTANT_BEFORE_STOP'),
    });

    log(`process-exit fixture exiting with code ${PROCESS_EXIT_FIXTURE_CODE}`);
    process.exitCode = PROCESS_EXIT_FIXTURE_CODE;
    process.exit(PROCESS_EXIT_FIXTURE_CODE);
  };

  const runFileLinkStream = async (session) => {
    await emit(session.sessionId, {
      sessionUpdate: 'agent_message_chunk',
      content: text(`BDD_FILE_LINK_READY

Open test/test.js:L1-L2
Inline \`test/test.js:1:1\`
External label [test/test.js](https://example.com/opensumi-file-link-label)

\`\`\`text
test/test.js
\`\`\`
`),
    });
  };

  return {
    async initialize(params) {
      log('initialize', params?.protocolVersion);
      return {
        protocolVersion: params.protocolVersion,
        agentInfo: {
          name: 'opensumi-bdd-mock-acp-agent',
          title: 'OpenSumi BDD Mock ACP Agent',
          version: '1.0.0',
        },
        agentCapabilities: {
          loadSession: true,
          sessionCapabilities: {
            list: {},
            loadSession: {},
            close: {},
          },
          mcpCapabilities: {
            http: true,
          },
          promptCapabilities: {
            image: false,
            audio: false,
            embeddedContext: true,
          },
        },
      };
    },

    async newSession(params) {
      if (options.fixture === 'create-failure') {
        throw RequestError.internalError({ fixture: options.fixture }, 'BDD create-session failure');
      }

      loadSessionStore(params.cwd);
      // The test harness may create several ACP threads for one workspace.
      // Each thread starts a fresh mock process, so the local counter alone
      // would otherwise return the same id from every process.
      const sessionId = `${options.sessionPrefix}-${process.pid}-${nextSessionNumber++}`;
      const session = createSessionRecord(sessionId, params.cwd);
      sessions.set(sessionId, session);
      persistSessionStore(params.cwd);
      await emitInitialSessionUpdates(session);
      scheduleAvailableCommandsUpdate(session);
      return responseForSession(session);
    },

    async loadSession(params) {
      if (options.fixture === 'load-failure' || options.fixture === 'task-session-missing') {
        throw RequestError.resourceNotFound(params.sessionId);
      }

      loadSessionStore(params.cwd);
      const session = getOrCreateSession(params.sessionId, params.cwd);
      // A real ACP Agent reloads persisted history after the browser reconnects.
      // Dynamic fixture sessions live only in a mock process, so give an unknown
      // history session a bounded replay payload when it is reloaded on a new
      // process.
      if (options.fixture === 'history' && !session.historySeed) {
        session.historySeed =
          options.historyMessageCount > 0
            ? `long-${params.sessionId.replace(/[^a-z0-9]+/gi, '-').slice(-12)}`
            : 'restored';
        session.promptCount = 1;
      }
      session.updatedAt = nowIso();
      persistSessionStore(session.cwd);
      await emitInitialSessionUpdates(session);
      await emitHistoryReplay(session);
      scheduleAvailableCommandsUpdate(session);
      return responseForSession(session);
    },

    async listSessions(params = {}) {
      if (options.fixture === 'list-failure') {
        throw RequestError.internalError(
          { fixture: options.fixture, service: 'session' },
          'BDD list-session failure',
        );
      }
      loadSessionStore(params.cwd);
      if ((options.fixture === 'history' || options.fixture === 'load-failure') && params.cwd && !historySeedCwd) {
        historySeedCwd = params.cwd;
        for (const session of sessions.values()) {
          if (session.historySeed === 'alpha' || session.historySeed === 'beta') {
            session.cwd = historySeedCwd;
          }
        }
        persistSessionStore(params.cwd);
      }
      const allSessions = [...sessions.values()]
        .filter((session) => !params.cwd || session.cwd === params.cwd)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return { sessions: allSessions.map(sessionInfo) };
    },

    async setSessionMode(params) {
      const session = getOrCreateSession(params.sessionId);
      session.mode = params.modeId;
      session.updatedAt = nowIso();
      await emit(params.sessionId, {
        sessionUpdate: 'current_mode_update',
        currentModeId: session.mode,
      });
      return {};
    },

    async unstable_setSessionModel(params) {
      const session = getOrCreateSession(params.sessionId);
      session.model = params.modelId || params.model || session.model;
      session.updatedAt = nowIso();
      return {};
    },

    async setSessionConfigOption(params) {
      if (options.fixture === 'config-failure') {
        throw RequestError.invalidParams({ fixture: options.fixture, configId: params.configId }, 'BDD config failure');
      }

      const session = getOrCreateSession(params.sessionId);
      if (params.configId === 'bdd-mode') {
        session.mode = params.value;
      } else if (params.configId === 'bdd-model') {
        session.model = params.value;
      } else if (params.configId === 'bdd-thought-level') {
        session.thought = params.value;
      } else if (params.configId === 'bdd-web-search') {
        session.webSearch = params.value;
      }
      session.updatedAt = nowIso();
      const configOptions = createConfigOptions(session);
      await emit(params.sessionId, {
        sessionUpdate: 'config_option_update',
        configOptions,
      });
      return { configOptions };
    },

    async prompt(params) {
      if (options.fixture === 'send-failure') {
        throw RequestError.internalError({ fixture: options.fixture }, 'BDD send failure');
      }
      if (options.fixture === 'service-failure') {
        throw RequestError.internalError(
          { fixture: options.fixture, service: 'session', errorName: 'DatabaseError' },
          'OpenCode service failure',
        );
      }
      if (options.fixture === 'model-not-found') {
        throw RequestError.invalidParams(
          { fixture: options.fixture, providerId: 'cfuse', modelId: 'cfuse/GLM-5.2' },
          'model not found: cfuse/GLM-5.2',
        );
      }
      if (options.fixture === 'auth-required') {
        throw RequestError.authRequired({ fixture: options.fixture }, 'BDD auth required');
      }

      const session = getOrCreateSession(params.sessionId);
      session.promptCount += 1;
      session.title = `BDD Turn ${session.promptCount}`;
      session.updatedAt = nowIso();
      persistSessionStore(session.cwd);
      const promptText = extractPromptText(params.prompt);

      await emit(params.sessionId, {
        sessionUpdate: 'session_info_update',
        title: session.title,
        updatedAt: session.updatedAt,
      });
      await emit(params.sessionId, {
        sessionUpdate: 'user_message_chunk',
        content: text(`BDD_USER_TURN_${session.promptCount}`),
      });
      await sleep();

      if (options.fixture === 'long-stream') {
        return runLongStream(session);
      }
      if (options.fixture === 'permission') {
        return runPermission(session);
      }
      if (options.fixture === 'process-exit') {
        return runProcessExit(session);
      }
      if (options.fixture === 'file-link') {
        await runFileLinkStream(session);
        return {
          stopReason: 'end_turn',
          usage: {
            inputTokens: Math.max(1, promptText.length),
            outputTokens: 24,
            totalTokens: Math.max(1, promptText.length) + 24,
            thoughtTokens: 0,
          },
        };
      }

      await runRichStream(session, promptText);
      const response = {
        stopReason: 'end_turn',
        usage: {
          inputTokens: Math.max(1, promptText.length),
          outputTokens: 32,
          totalTokens: Math.max(1, promptText.length) + 32,
          thoughtTokens: 4,
        },
      };
      if (options.fixture === 'task-session-missing') {
        setTimeout(() => process.exit(TASK_SESSION_MISSING_EXIT_CODE), 50);
      }
      return response;
    },

    async cancel(params) {
      const pending = pendingPrompts.get(params.sessionId);
      if (pending) {
        pending.cancel();
      }
    },

    async unstable_forkSession(params) {
      const source = getOrCreateSession(params.sessionId, params.cwd);
      const sessionId = `${source.sessionId}-fork`;
      const session = {
        ...source,
        sessionId,
        title: `${source.title} Fork`,
        updatedAt: nowIso(),
      };
      sessions.set(sessionId, session);
      return { sessionId };
    },

    async unstable_resumeSession(params) {
      getOrCreateSession(params.sessionId, params.cwd);
      return {};
    },

    async unstable_closeSession(params) {
      sessions.delete(params.sessionId);
      return {};
    },

    async authenticate() {
      return {};
    },
  };
}

const input = Readable.toWeb(process.stdin);
const output = Writable.toWeb(process.stdout);
const stream = ndJsonStream(output, input);
const connection = new AgentSideConnection((conn) => createAgent(conn), stream);

connection.closed.catch((error) => {
  console.error('[mock-acp-agent] connection failed', error);
  process.exitCode = 1;
});
