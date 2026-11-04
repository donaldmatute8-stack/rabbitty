/**
 * ── Permisos del POS por rol ──
 *
 * Fuente ÚNICA para servidor y UI. Es un archivo puro (sin DB ni imports de
 * servidor) para poder usarlo también en componentes cliente.
 *
 * Regla de oro: el rol NUNCA amplía el alcance de sucursal. Un cajero sigue
 * atado a su sucursal; lo único que cambia es qué acciones puede ejecutar.
 *
 * Roles:
 *   OWNER    · dueño de la cuenta (sin staffRole en el panel)
 *   ADMIN    · administrador de la sucursal
 *   MANAGER  · gerente (puede todo lo operativo)
 *   CASHIER  · cajero (cobra y maneja caja, no reembolsa ni descuenta)
 *   WAITER   · mesero (toma pedidos y cobra, no toca caja ni reembolsos)
 *   KITCHEN  · cocina (usa KDS; el POS queda en solo lectura)
 */

export type PosRole = "OWNER" | "ADMIN" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";

export type PosPermission =
  | "POS_ORDERS"
  | "POS_CHARGE"
  | "POS_CASH"
  | "POS_DISCOUNT"
  | "POS_REFUND"
  | "POS_SETTINGS"
  | "POS_REPORTS";

const ALL_PERMISSIONS: PosPermission[] = [
  "POS_ORDERS",
  "POS_CHARGE",
  "POS_CASH",
  "POS_DISCOUNT",
  "POS_REFUND",
  "POS_SETTINGS",
  "POS_REPORTS",
];

export const POS_ROLE_PERMISSIONS: Record<PosRole, PosPermission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,
  MANAGER: ALL_PERMISSIONS,
  // Cobra, maneja caja y redime; no reembolsa, no regala cortesías ni configura.
  CASHIER: ["POS_ORDERS", "POS_CHARGE", "POS_CASH"],
  // Toma pedidos y cobra. No abre/cierra caja ni reembolsa.
  WAITER: ["POS_ORDERS", "POS_CHARGE"],
  // Su operación vive en /kitchen.
  KITCHEN: [],
};

export const POS_ROLE_LABELS: Record<PosRole, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  CASHIER: "Cajero",
  WAITER: "Mesero",
  KITCHEN: "Cocina",
};

export const POS_PERMISSION_LABELS: Record<PosPermission, string> = {
  POS_ORDERS: "tomar y editar pedidos",
  POS_CHARGE: "cobrar",
  POS_CASH: "abrir, cerrar y mover caja",
  POS_DISCOUNT: "aplicar cortesías o descuentos",
  POS_REFUND: "reembolsar",
  POS_SETTINGS: "cambiar configuración del POS",
  POS_REPORTS: "ver reportes",
};

/** Normaliza cualquier variante (minúsculas, roles legacy) a un rol del POS. */
export function normalizePosRole(role?: string | null): PosRole | null {
  if (!role) return null;
  const value = String(role).trim().toUpperCase();
  if (value === "OWNER" || value === "ADMIN" || value === "MANAGER" || value === "CASHIER" || value === "WAITER" || value === "KITCHEN") {
    return value as PosRole;
  }
  // Alias razonables que pueden existir en datos viejos.
  if (value === "CASHIER_ROLE" || value === "CAJERO") return "CASHIER";
  if (value === "MESERO") return "WAITER";
  if (value === "COCINA") return "KITCHEN";
  if (value === "GERENTE") return "MANAGER";
  return null;
}

export function permissionsForRole(role?: string | null): PosPermission[] {
  const normalized = normalizePosRole(role);
  return normalized ? [...POS_ROLE_PERMISSIONS[normalized]] : [];
}

export function hasPosPermission(role: string | null | undefined, permission: PosPermission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function posRoleLabel(role?: string | null): string {
  const normalized = normalizePosRole(role);
  return normalized ? POS_ROLE_LABELS[normalized] : "Sin turno";
}

export function posPermissionLabel(permission: PosPermission): string {
  return POS_PERMISSION_LABELS[permission] ?? permission;
}
