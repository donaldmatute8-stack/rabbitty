import { test, expect, Route } from "@playwright/test";
import { mockTables, mockCategories, mockMenuItems, mockOrdersWithItems } from "./mocks";

function mockProcedure(proc: string, input: any) {
  switch (proc) {
    case "pos.getTables":
      return { result: { data: mockTables } };
    case "pos.getCategories":
      return { result: { data: mockCategories } };
    case "pos.getMenuItems":
      if (input?.categoryId) {
        return { result: { data: mockMenuItems.filter((i) => i.categoryId === input.categoryId) } };
      }
      return { result: { data: mockMenuItems } };
    case "pos.getOrders":
      if (input?.tableId === "t3") {
        return { result: { data: mockOrdersWithItems } };
      }
      return { result: { data: [] } };
    case "pos.createOrder":
      return {
        result: {
          data: {
            id: "new-order-" + Date.now(),
            branchId: "b1",
            tableId: input?.tableId ?? null,
            orderType: input?.orderType ?? "DINE_IN",
            status: "OPEN",
            subtotal: 0,
            tax: 0,
            discount: 0,
            tip: 0,
            total: 0,
            customerName: input?.customerName ?? null,
            customerPhone: input?.customerPhone ?? null,
            voidReason: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };
    case "pos.addToCart":
      return {
        result: {
          data: {
            id: "new-oi-" + Date.now(),
            orderId: input?.orderId,
            menuItemId: input?.menuItemId,
            quantity: input?.quantity ?? 1,
            unitPrice: mockMenuItems.find((i) => i.id === input?.menuItemId)?.price ?? 0,
            totalPrice: (input?.quantity ?? 1) * (mockMenuItems.find((i) => i.id === input?.menuItemId)?.price ?? 0),
            modifiers: input?.modifiers ?? null,
            notes: input?.notes ?? null,
            status: "PENDING",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };
    case "pos.removeFromCart":
      return { result: { data: { success: true } } };
    case "pos.clearCart":
      return { result: { data: { success: true } } };
    case "pos.payOrder":
      return { result: { data: { success: true } } };
    case "admin.getDashboardStats":
      return { result: { data: { totalOrders: 42, totalRevenue: 12500, activeTables: 8, totalCustomers: 156 } } };
    case "admin.getSalesReport":
      return { result: { data: { totalSales: 5200, totalOrders: 28 } } };
    default:
      return { result: { data: null } };
  }
}

async function handleTrpc(route: Route) {
  const url = new URL(route.request().url());
  const proceduresStr = url.pathname.replace(/^\/api\/trpc\/?/, "");
  if (!proceduresStr) {
    return route.fulfill({ status: 404 });
  }
  let body: Record<string, any> = {};
  try {
    const postData = route.request().postDataJSON();
    if (postData) {
      body = postData;
    }
  } catch {}
  const procedures = proceduresStr.split(",");
  const results = procedures.map((proc, i) => mockProcedure(proc.trim(), body[i]?.json));
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(results) });
}

test.describe("POS Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/trpc**", handleTrpc);
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: "e2e-test-user", name: "E2E Tester", email: "e2e@test.me" }, expires: "2099-01-01T00:00:00.000Z" }),
      });
    });
  });

  test("Login page renders and shows form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Rabbitty POS")).toBeVisible();
    await expect(page.getByText("Ingresa con tu correo")).toBeVisible();
    await expect(page.getByPlaceholder("tu@correo.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar enlace mágico" })).toBeVisible();
  });

  test("Main page loads table grid", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Mesas" })).toBeVisible();
    await expect(page.getByText("Selecciona una mesa")).toBeVisible();
    await expect(page.getByText("1").first()).toBeVisible();
    await expect(page.getByText("2 personas").first()).toBeVisible();
  });

  test("Clicking table opens CartDrawer with menu", async ({ page }) => {
    await page.goto("/");
    await page.locator("button").filter({ hasText: "1" }).first().click();
    await expect(page.getByText("Desayunos")).toBeVisible();
    await expect(page.getByText("Bebidas")).toBeVisible();
    await expect(page.getByText("Postres")).toBeVisible();
  });

  test("Browsing menu categories in CartDrawer", async ({ page }) => {
    await page.goto("/");
    await page.locator("button").filter({ hasText: "1" }).first().click();
    await expect(page.getByText("Chilaquiles")).toBeVisible();
    await page.getByText("Bebidas").click();
    await expect(page.getByText("Café Americano")).toBeVisible();
    await expect(page.getByText("Jugo de Naranja")).toBeVisible();
    await page.getByText("Desayunos").click();
    await expect(page.getByText("Chilaquiles")).toBeVisible();
  });

  test("Add item to cart shows item count and totals", async ({ page }) => {
    await page.goto("/");
    await page.locator("button").filter({ hasText: "1" }).first().click();
    await page.getByText("Chilaquiles").first().click();
    await expect(page.getByText("1 item(s)")).toBeVisible();
    await expect(page.getByText("Chilaquiles").first()).toBeVisible();
    await expect(page.getByText("Subtotal")).toBeVisible();
    await expect(page.getByText("IVA (16%)")).toBeVisible();
    await expect(page.getByText("Total").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Orden guardada" })).toBeVisible();
  });

  test("Multiple items in cart update item count", async ({ page }) => {
    await page.goto("/");
    await page.locator("button").filter({ hasText: "1" }).first().click();
    await page.getByText("Chilaquiles").first().click();
    await page.getByText("Café Americano").first().click();
    await expect(page.getByText("2 item(s)")).toBeVisible();
  });

  test("Item marked as agotado is visible", async ({ page }) => {
    await page.goto("/");
    await page.locator("button").filter({ hasText: "1" }).first().click();
    await expect(page.getByText("Hotcakes")).toBeVisible();
    await expect(page.getByText("Agotado")).toBeVisible();
  });

  test("Para llevar button shows CartDrawer for quick order", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Para llevar" }).click();
    await expect(page.getByText("Menú")).toBeVisible();
    await expect(page.getByText("Chilaquiles")).toBeVisible();
  });

  test("Table with active order opens CartDrawer", async ({ page }) => {
    await page.goto("/");
    await page.locator("button").filter({ hasText: "3" }).first().click();
    await expect(page.getByText("Menú")).toBeVisible();
  });

  test("Sidebar navigation links are visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Mesas" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Menú" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Órdenes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Historial" })).toBeVisible();
  });

  test("Para llevar flow: add items without table", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Para llevar" }).click();
    await page.getByText("Café Americano").click();
    await expect(page.getByText("1 item(s)")).toBeVisible();
  });
});
