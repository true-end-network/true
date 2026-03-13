import { test, expect } from "@playwright/test"

test.describe("Contact Pairing Flow", () => {
  test("should generate a pairing link and accept it in another context", async ({ browser }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    // Person A: navigate to /pair and generate a link
    await pageA.goto("/pair")
    await pageA.waitForLoadState("networkidle")
    await pageA.click("text=Generate Pairing Link")

    // Wait for the link input to appear
    const linkInput = pageA.locator("input[readonly]")
    await expect(linkInput).toBeVisible()
    const pairingUrl = await linkInput.inputValue()
    expect(pairingUrl).toContain("/pair#")

    // Person A: name the contact and save
    await pageA.fill('input[placeholder="Name this contact..."]', "Bob")
    await pageA.click("text=Save Contact")

    // Should redirect to /contacts
    await expect(pageA).toHaveURL("/contacts", { timeout: 10000 })
    await expect(pageA.locator("text=Bob")).toBeVisible()

    // Person B: open the pairing link
    const relativePath = new URL(pairingUrl).pathname + new URL(pairingUrl).hash
    await pageB.goto(relativePath)
    await pageB.waitForLoadState("networkidle")

    // Person B: should see the accept pairing UI
    await expect(pageB.locator("text=Accept Pairing")).toBeVisible()

    // Person B: name and accept
    await pageB.fill('input[placeholder="Name this contact..."]', "Alice")
    await pageB.click("text=Accept & Save")

    // Should redirect to /contacts
    await expect(pageB).toHaveURL("/contacts", { timeout: 10000 })
    await expect(pageB.locator("text=Alice")).toBeVisible()

    await contextA.close()
    await contextB.close()
  })

  test("should navigate from home to contacts to pair", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.locator('a[href="/contacts"]').click()
    await expect(page).toHaveURL("/contacts", { timeout: 10000 })

    await page.locator('a[href="/pair"]').click()
    await expect(page).toHaveURL("/pair", { timeout: 10000 })
  })
})
