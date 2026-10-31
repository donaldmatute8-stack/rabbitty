import { handlers } from "@rabbitty/auth";

// next-auth v4 exports Node-style handlers; cast them to the App Router handler shape.
type RouteHandler = (
  request: Request,
  context: { params: Promise<Record<string, string[]>> }
) => Promise<Response>;

export const GET = handlers.GET as unknown as RouteHandler;
export const POST = handlers.POST as unknown as RouteHandler;