import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@rabbitty/api";

export const trpc = createTRPCReact<AppRouter>();
