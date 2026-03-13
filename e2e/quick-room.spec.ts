import { test, expect, type BrowserContext } from "@playwright/test"

// Helper to seed a contact into localStorage
async function seedContact(context: BrowserContext, baseURL: string, contact: {
  id: string
  name: string
  sharedSecret: string
}) {
  const page = await context.newPage()
  await page.goto(baseURL)
  await page.evaluate((c) => {
    const store = {
      state: {
        contacts: [{
          id: c.id,
          name: c.name,
          sharedSecret: c.sharedSecret,
          createdAt: Date.now(),
          lastSequence: 0,
          lastSequenceDate: "",
        }],
      },
      version: 0,
    }
    localStorage.setItem("true-contacts", JSON.stringify(store))
  }, contact)
  await page.close()
}

test.describe("Quick Room Creation", () => {
  const SHARED_SECRET = "dGVzdHNlY3JldDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=" // 32 bytes base64

  test("both contacts derive the same room and connect", async ({ browser }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()

    // Seed the same shared secret in both contexts
    await seedContact(contextA, "http://localhost:3000", {
      id: "test-contact-a",
      name: "Bob",
      sharedSecret: SHARED_SECRET,
    })

    await seedContact(contextB, "http://localhost:3000", {
      id: "test-contact-b",
      name: "Alice",
      sharedSecret: SHARED_SECRET,
    })

    // Person A: go to contacts and click Chat
    const pageA = await contextA.newPage()
    await pageA.goto("/contacts")
    await expect(pageA.locator("text=Bob")).toBeVisible()
    await pageA.click("text=Chat")

    // Should navigate to observe page
    await expect(pageA).toHaveURL(/\/room\/observe#/)

    // Person B: go to contacts and click Chat
    const pageB = await contextB.newPage()
    await pageB.goto("/contacts")
    await expect(pageB.locator("text=Alice")).toBeVisible()
    await pageB.click("text=Chat")

    await expect(pageB).toHaveURL(/\/room\/observe#/)

    // Both should show connected state
    await expect(pageA.locator("text=Connected")).toBeVisible({ timeout: 10000 })
    await expect(pageB.locator("text=Connected")).toBeVisible({ timeout: 10000 })

    await contextA.close()
    await contextB.close()
  })
})
