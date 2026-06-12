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

// Inicializa el Worker de BullMQ para Marketing Masivo (Fase 11)
// En un futuro MVP esto debería moverse a un microservicio independiente.
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
});

export type AppRouter = typeof appRouter;
