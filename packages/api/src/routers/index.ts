import { router } from "../trpc";
import { posRouter } from "./pos";
import { posTerminalsRouter } from "./posTerminals";
import { posOperatorsRouter } from "./posOperators";
import { kdsRouter } from "./kds";
import { stationsRouter } from "./stations";
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
import { dwellAnalyticsRouter } from "./dwellAnalytics";
import { behaviorRulesRouter } from "./behaviorRules";
import { waitlistRouter } from "./waitlist";
import { suppliersRouter } from "./suppliers";
import { expensesRouter } from "./expenses";
import { invoicesRouter } from "./invoices";
import { cfdiRouter } from "./cfdi";
import { cateringRouter } from "./catering";
import { pricingRouter } from "./pricing";
import { campaignsRouter } from "./campaigns";
import { membershipsRouter } from "./memberships";
import { reconciliationRouter } from "./reconciliation";
import { loyaltyRouter } from "./loyalty";
import { tableLayoutRouter } from "./tableLayout";
import { settingsRouter } from "./settings";
import { totpRouter } from "./totp";
import { passkeysRouter } from "./passkeys";
import { trustedSessionsRouter } from "./trustedSessions";
import { aiRouter } from "./ai";
import { sandboxRouter } from "./sandbox";
import { cashDropsRouter } from "./cashDrops";
import { cashShiftsRouter } from "./cashShifts";
import { customerChatRouter } from "./customerChat";
import { moodRouter } from "./mood";
import { bunzyRouter } from "./bunzy";
import { bunzyConnectRouter } from "./bunzyConnect";
import { updatesRouter } from "./updates";
import { godRouter } from "./god";
import { ratingsRouter } from "./ratings";
import "../services/queue";

export const appRouter = router({
  pos: posRouter,
  posTerminals: posTerminalsRouter,
  posOperators: posOperatorsRouter,
  kds: kdsRouter,
  stations: stationsRouter,
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
  dwellAnalytics: dwellAnalyticsRouter,
  behaviorRules: behaviorRulesRouter,
  waitlist: waitlistRouter,
  suppliers: suppliersRouter,
  expenses: expensesRouter,
  invoices: invoicesRouter,
  cfdi: cfdiRouter,
  catering: cateringRouter,
  pricing: pricingRouter,
  campaigns: campaignsRouter,
  memberships: membershipsRouter,
  reconciliation: reconciliationRouter,
  loyalty: loyaltyRouter,
  tableLayout: tableLayoutRouter,
  settings: settingsRouter,
  totp: totpRouter,
  passkeys: passkeysRouter,
  trustedSessions: trustedSessionsRouter,
  ai: aiRouter,
  sandbox: sandboxRouter,
  cashDrops: cashDropsRouter,
  cashShifts: cashShiftsRouter,
  customerChat: customerChatRouter,
  mood: moodRouter,
  bunzy: bunzyRouter,
  bunzyConnect: bunzyConnectRouter,
  updates: updatesRouter,
  god: godRouter,
  ratings: ratingsRouter,
});

export type AppRouter = typeof appRouter;
