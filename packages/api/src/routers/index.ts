import { router } from "../trpc";
import { posRouter } from "./pos";
import { kdsRouter } from "./kds";
import { adminRouter } from "./admin";
import { staffRouter } from "./staff";
import { inventoryRouter } from "./inventory";
import { customerRouter } from "./customer";
import { reservationsRouter } from "./reservations";
import { paymentsRouter } from "./payments";
import { notificationsRouter } from "./notifications";
import { printingRouter } from "./printing";
import { webhooksRouter } from "./webhooks";
import { fastapiBridgeRouter } from "./fastapi-bridge";
import { crmRouter } from "./crm";
import { analyticsRouter } from "./analytics";
import { waitlistRouter } from "./waitlist";
import { suppliersRouter } from "./suppliers";
import { expensesRouter } from "./expenses";
import { invoicesRouter } from "./invoices";
import { cateringRouter } from "./catering";
import { pricingRouter } from "./pricing";
import { campaignsRouter } from "./campaigns";
import { loyaltyRouter } from "./loyalty";
import { tableLayoutRouter } from "./tableLayout";
import { settingsRouter } from "./settings";
import { totpRouter } from "./totp";
import { passkeysRouter } from "./passkeys";
import { trustedSessionsRouter } from "./trustedSessions";

import "../services/queue";

export const appRouter = router({
  pos: posRouter,
  kds: kdsRouter,
  admin: adminRouter,
  staff: staffRouter,
  inventory: inventoryRouter,
  customer: customerRouter,
  reservations: reservationsRouter,
  payments: paymentsRouter,
  notifications: notificationsRouter,
  printing: printingRouter,
  webhooks: webhooksRouter,
  fastapi: fastapiBridgeRouter,
  crm: crmRouter,
  analytics: analyticsRouter,
  waitlist: waitlistRouter,
  suppliers: suppliersRouter,
  expenses: expensesRouter,
  invoices: invoicesRouter,
  catering: cateringRouter,
  pricing: pricingRouter,
  campaigns: campaignsRouter,
  loyalty: loyaltyRouter,
  tableLayout: tableLayoutRouter,
  settings: settingsRouter,
  totp: totpRouter,
  passkeys: passkeysRouter,
  trustedSessions: trustedSessionsRouter,
});

export type AppRouter = typeof appRouter;
