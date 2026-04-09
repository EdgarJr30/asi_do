import { expect, test } from '@playwright/test'

async function completeForProfitFlow(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/eligibility')

  await page.getByRole('button', { name: 'Sí' }).click()
  await page.getByRole('button', { name: 'Unión Dominicana (UDA)' }).click()
  await page
    .getByRole('button', {
      name: /Mi organización/i
    })
    .click()
  await page
    .getByRole('button', {
      name: /Con fines de lucro/i
    })
    .click()
  await page.getByRole('button', { name: 'Dos o más' }).click()
  await page
    .getByRole('button', {
      name: /La organización es de propiedad y operación independiente/i
    })
    .click()
  await page
    .getByRole('button', { name: /Continuar con la solicitud/i })
    .click()
}

test('debug membership application for organizational for profit mobile', async ({
  page
}) => {
  const consoleMessages: string[] = []
  const pageErrors: string[] = []

  page.on('console', (message) => {
    consoleMessages.push(`[${message.type()}] ${message.text()}`)
  })

  page.on('pageerror', (error) => {
    pageErrors.push(`${error.name}: ${error.message}`)
  })

  await completeForProfitFlow(page)

  await page.waitForTimeout(1500)
  await page.screenshot({
    path: 'tmp/playwright-membership-apply-debug.png',
    fullPage: true
  })

  console.log('URL final:', page.url())
  console.log('PAGE ERRORS:', pageErrors)
  console.log('CONSOLE MESSAGES:', consoleMessages)
  console.log('BODY TEXT:', await page.locator('body').innerText())

  expect(pageErrors).toEqual([])
  await expect(
    page.getByRole('heading', { name: /Solicitud de membresía ASI/i })
  ).toBeVisible()
})

test.describe('desktop viewport', () => {
  test.use({
    viewport: { width: 1440, height: 1200 },
    isMobile: false,
    hasTouch: false
  })

  test('debug membership application for organizational for profit desktop', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(`${error.name}: ${error.message}`)
    })

    await completeForProfitFlow(page)
    await page.waitForTimeout(1500)
    await page.screenshot({
      path: 'tmp/playwright-membership-apply-debug-desktop.png',
      fullPage: true
    })

    console.log('DESKTOP URL FINAL:', page.url())
    console.log('DESKTOP PAGE ERRORS:', pageErrors)
    console.log('DESKTOP BODY TEXT:', await page.locator('body').innerText())

    expect(pageErrors).toEqual([])
    await expect(
      page.getByRole('heading', { name: /Solicitud de membresía ASI/i })
    ).toBeVisible()
    await expect(page.getByLabel(/Nombre/i).first()).toBeVisible()
  })
})
