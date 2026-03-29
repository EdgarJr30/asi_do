import { expect, test } from '@playwright/test'

test.describe('institutional editorial carousel', () => {
  test('keeps autoplay moving and recenters the loop before edge blanks appear', async ({
    page,
    browserName
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    const viewport = page.getByLabel('Historias destacadas de ASI')
    await expect(viewport).toBeVisible()
    await viewport.scrollIntoViewIfNeeded()

    const readMetrics = async () =>
      viewport.evaluate((node) => {
        const viewportElement = node as HTMLDivElement
        const primarySet = viewportElement.querySelector(
          '[data-carousel-set="primary"]'
        )
        const gap = primarySet
          ? Number.parseFloat(window.getComputedStyle(primarySet).gap || '0')
          : 0
        const setWidth = primarySet
          ? primarySet.getBoundingClientRect().width + gap
          : 0

        return {
          scrollLeft: viewportElement.scrollLeft,
          scrollWidth: viewportElement.scrollWidth,
          clientWidth: viewportElement.clientWidth,
          setWidth
        }
      })

    await expect
      .poll(async () => {
        const metrics = await readMetrics()
        return metrics.scrollLeft > 0 && metrics.setWidth > 0
      })
      .toBe(true)

    if (browserName === 'webkit') {
      const initialMetrics = await readMetrics()

      await page.waitForTimeout(900)

      const autoplayMetrics = await readMetrics()

      expect(
        Math.abs(autoplayMetrics.scrollLeft - initialMetrics.scrollLeft)
      ).toBeGreaterThan(4)
    }

    await viewport.evaluate((node) => {
      const viewportElement = node as HTMLDivElement
      viewportElement.scrollLeft =
        viewportElement.scrollWidth - viewportElement.clientWidth
      viewportElement.dispatchEvent(new Event('scroll'))
    })

    await expect
      .poll(async () => {
        const metrics = await readMetrics()
        return metrics.scrollLeft < metrics.scrollWidth - metrics.clientWidth - 24
      })
      .toBe(true)

    await expect
      .poll(async () => {
        const metrics = await readMetrics()

        return (
          metrics.scrollLeft > metrics.setWidth * 0.5 &&
          metrics.scrollLeft < metrics.setWidth * 1.5
        )
      })
      .toBe(true)
  })
})
