// Source: test/bdd/acp-chat.scenario.md

import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';

let app: OpenSumiApp;

test.describe('ACP Chat default WebMCP surface', () => {
  test.beforeAll(async () => {
    const workspace = new OpenSumiWorkspace([path.resolve(__dirname, '../../src/tests/workspaces/default')]);
    app = await OpenSumiApp.load(page, workspace);
  });

  test.afterAll(() => {
    app.dispose();
  });

  test('opens ACP chat and exposes safe metadata-only state tools', async () => {
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
    await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));

    const result = await page.evaluate(async () => {
      const modelContext = (navigator as any).modelContext;
      const tools = await modelContext.getTools();
      const toolNames = tools.map((tool: { name: string }) => tool.name).sort();
      const legacyNames = [
        'acp_sendMessage',
        'acp_createSession',
        'acp_switchSession',
        'acp_clearSession',
        'acp_cancelRequest',
        'acp_handlePermissionDialog',
        'acp_chat_getSessionState',
        'acp_chat_getPermissionState',
        'acp_chat_showChatView',
      ];

      const show = await modelContext.executeTool('acp_chat_show_chat_view', {});
      const sessionState = await modelContext.executeTool('acp_chat_get_session_state', {});
      const permissionState = await modelContext.executeTool('acp_chat_get_permission_state', {});
      let camelCaseResult: any;
      try {
        camelCaseResult = await modelContext.executeTool('acp_chat_getSessionState', {});
      } catch (error) {
        camelCaseResult = { success: false, error: String(error) };
      }

      return {
        toolNames,
        acpTools: toolNames.filter((name: string) => name.startsWith('acp_chat')),
        forbiddenTools: toolNames.filter((name: string) => legacyNames.includes(name) || name.startsWith('_opensumi/')),
        show,
        sessionState,
        permissionState,
        camelCaseResult,
      };
    });

    expect(result.acpTools).toEqual([
      'acp_chat_get_permission_state',
      'acp_chat_get_session_state',
      'acp_chat_show_chat_view',
    ]);
    expect(result.forbiddenTools).toEqual([]);
    expect(result.show).toMatchObject({ success: true, result: { shown: true } });
    expect(result.camelCaseResult.success).toBe(false);

    expect(result.sessionState.success).toBe(true);
    if (result.sessionState.result.active) {
      const session = result.sessionState.result.session;
      expect(Object.keys(session).sort()).toEqual(
        expect.arrayContaining([
          'createdAt',
          'hasPendingPermission',
          'historyMessageCount',
          'modelId',
          'rawSessionId',
          'requestCount',
          'sessionId',
          'slicedMessageCount',
          'threadStatus',
          'title',
        ]),
      );
      expect(session.messages).toBeUndefined();
      expect(session.content).toBeUndefined();
      expect(session.toolCallResults).toBeUndefined();
    }

    expect(result.permissionState.success).toBe(true);
    expect(Object.keys(result.permissionState.result).sort()).toEqual(
      expect.arrayContaining(['activeDialogCount', 'activeSessionId', 'pendingCountExcludingActive']),
    );
  });
});
