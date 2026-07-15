import { type Page, expect } from '@playwright/test';

/** Launch the current workspace from the Agentic Chat header Agent menu without opening a Project picker. */
export async function launchTaskInCurrentProject(page: Page, agentId = 'claude-agent-acp'): Promise<string> {
  const launcher = page.getByTestId('agentic-chat-panel-header').getByTestId('agentic-task-launch-button');
  await expect(launcher).toBeVisible({ timeout: 30_000 });
  await launcher.click();
  const agentMenu = page.getByTestId('agentic-chat-panel-header').getByTestId('agentic-task-agent-menu');
  await expect(agentMenu).toBeVisible();
  await expect(page.getByText('Choose Project', { exact: true })).toHaveCount(0);
  await agentMenu.getByTestId(`agentic-task-agent-option-${agentId}`).click();
  await expect(agentMenu).toBeHidden();
  return agentId;
}
