import { expect, type Page } from '@playwright/test';

export async function confirmAction(page: Page, label: string) {
  const confirmation = page.getByRole('alertdialog');
  await confirmation.getByRole('button', { name: label, exact: true }).click();
  await expect(confirmation).toBeHidden();
}
