import { expect, labelPointCount, test } from './fixtures'

test('renders the map canvas on startup', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('canvas')).toBeVisible()
})

test('HUD shows marker stats from the official snapshot', async ({ page }) => {
  await page.goto('./')
  const total = await import('./fixtures').then((m) => m.expectedDefaultMarkerCount())
  await expect(page.getByText(new RegExp(`markers \\d+ / ${total}`))).toBeVisible({
    timeout: 30_000,
  })
})

test('layer panel filters point types and persists', async ({ page }) => {
  await page.goto('./')
  const total = await import('./fixtures').then((m) => m.expectedDefaultMarkerCount())
  const statues = labelPointCount('七天神像')
  await expect(page.getByText(new RegExp(`markers \\d+ / ${total}`))).toBeVisible({
    timeout: 30_000,
  })

  // First group (waypoints) starts open: unchecking 七天神像 drops the total
  await page.getByText('七天神像', { exact: true }).click()
  await expect(page.getByText(new RegExp(`/ ${total - statues}`))).toBeVisible({ timeout: 15_000 })

  // the selection survives reload (zustand persist -> localStorage)
  await page.reload()
  await expect(page.getByText(new RegExp(`/ ${total - statues}`))).toBeVisible({ timeout: 30_000 })
})
