import { test, expect } from "@playwright/test"

test.describe("Room Controls", () => {
  test("room creator sees controls, can lock room", async ({ page }) => {
    // Create a room from the home page
    await page.goto("/")
    await page.click("text=Generate Room")

    // Wait for room code to appear
    const codeInput = page.locator("input[readonly]")
    await expect(codeInput).toBeVisible()

    // Start observing
    await page.click("text=Start Observing")
    await expect(page).toHaveURL(/\/room\/observe#/)

    // Wait for connection
    await expect(page.locator("text=Connected")).toBeVisible({ timeout: 10000 })

    // Room creator should see Room Controls
    await expect(page.locator("text=Room Controls")).toBeVisible()

    // Expand controls
    await page.click("text=Room Controls")

    // Should see Lock Room button
    await expect(page.locator("text=Lock Room")).toBeVisible()

    // Lock the room
    await page.click("text=Lock Room")

    // Should now show Unlock Room
    await expect(page.locator("text=Unlock Room")).toBeVisible({ timeout: 5000 })
  })

  test("room creator can kill room", async ({ page }) => {
    await page.goto("/")
    await page.click("text=Generate Room")

    const codeInput = page.locator("input[readonly]")
    await expect(codeInput).toBeVisible()

    await page.click("text=Start Observing")
    await expect(page.locator("text=Connected")).toBeVisible({ timeout: 10000 })

    // Expand controls
    await page.click("text=Room Controls")

    // Click Kill Room
    await page.click("text=Kill Room")

    // Should show confirmation
    await expect(page.locator("text=Confirm Kill")).toBeVisible()
    await page.click("text=Confirm Kill")

    // Room should be deleted — shows error
    await expect(page.locator("text=Room deleted")).toBeVisible({ timeout: 5000 })
  })

  test("observer without deleteToken does not see controls", async ({ browser }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const creator = await contextA.newPage()
    const observer = await contextB.newPage()

    // Creator makes a room
    await creator.goto("/")
    await creator.click("text=Generate Room")

    const codeInput = creator.locator("input[readonly]")
    await expect(codeInput).toBeVisible()
    const roomCode = await codeInput.inputValue()

    // Creator starts observing
    await creator.click("text=Start Observing")
    await expect(creator.locator("text=Connected")).toBeVisible({ timeout: 10000 })

    // Creator should see Room Controls
    await expect(creator.locator("text=Room Controls")).toBeVisible()

    // Observer joins the same room
    await observer.goto("/")
    await observer.waitForLoadState("networkidle")
    await observer.fill('input[placeholder="Enter room code..."]', roomCode)
    await observer.locator('button:has-text("Observe")').click()
    await observer.waitForLoadState("networkidle")

    await expect(observer.locator("text=Connected")).toBeVisible({ timeout: 15000 })

    // Observer should NOT see Room Controls (no deleteToken)
    await expect(observer.locator("text=Room Controls")).not.toBeVisible()

    await contextA.close()
    await contextB.close()
  })
})
