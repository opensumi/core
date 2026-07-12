import { expect, type Page } from '@playwright/test';

/** Select a Project first, then an ACP Agent; never click the Project back row as an Agent. */
export async function launchTaskInCurrentProject(page: Page): Promise<string> {
  const launcher = page.getByTestId('agentic-task-launch-button');
  await expect(launcher).toBeVisible({ timeout: 30_000 });
  await launcher.click();

  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await menu.locator('[role="menuitem"]:not([disabled])').first().click();

  const projectBackRow = menu.getByRole('menuitem').filter({ hasText: /^←\s/ });
  await expect(projectBackRow).toBeVisible();
  const agentItem = menu.getByRole('menuitem').filter({ hasNotText: /^←\s/ }).first();
  await expect(agentItem).toBeVisible();
  const agentLabel = (await agentItem.innerText()).trim();
  await agentItem.click();
  await expect(menu).toBeHidden();

  return agentLabel;
}
