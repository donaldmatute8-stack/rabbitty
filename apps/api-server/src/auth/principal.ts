export type AuthMethod = "BUSINESS_SESSION" | "TELEGRAM" | "DEVICE" | "ANONYMOUS";

export interface Principal {
  subjectId: string;
  subjectType: "USER" | "DEVICE" | "ANONYMOUS";
  
  // The effectively resolved tenant for this request
  // (Empty if the user is operating outside a specific tenant context)
  tenantId?: string;
  
  // Array of roles assigned to this principal in the current context
  roles: string[];
  
  // Array of specific capabilities (e.g., ["pos:checkout", "bunz:issue"])
  capabilities: string[];

  // How this principal was authenticated for this request
  authMethod: AuthMethod;

  // Metadata associated with the specific session or device
  sessionId?: string;
  deviceId?: string;
}

export const AnonymousPrincipal: Principal = {
  subjectId: "anonymous",
  subjectType: "ANONYMOUS",
  roles: [],
  capabilities: [],
  authMethod: "ANONYMOUS",
};
