-- 0041_niche_requests.sql
-- Contexto de nicho + captura de nichos que todavía NO cubrimos.
--
-- ADITIVO: una columna nullable, filas de catálogo y una tabla nueva.
-- No toca POS, ni permisos, ni datos existentes.

-- ── Contexto del nicho ──────────────────────────────────────────────────────
-- `description` explica qué necesita ese tipo de negocio. La usan Bunzy (RAG),
-- el email de bienvenida y el formulario de solicitud. Sirve igual para nichos
-- activos y para nichos conocidos pero aún no soportados.
ALTER TABLE "niches" ADD COLUMN IF NOT EXISTS "description" text;

UPDATE "niches" SET "description" = 'Restaurante de mesa: mesas y cuentas por comensal, cocina/KDS, menú con modificadores, reservas, propinas, inventario y recetas.'
WHERE "id" = 'restaurant' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Cafetería / specialty coffee: barra rápida, pedidos para llevar, lealtad por visita e inventario de insumos.'
WHERE "id" = 'cafe' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Bar / cantina: cuentas abiertas, happy hour, control de barra, propinas y mesas.'
WHERE "id" = 'bar' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Panadería / postres: venta por pieza o charola, sin mesas, cobro rápido e inventario.'
WHERE "id" = 'bakery' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Pizzería: pedidos para recoger y a domicilio, menú con tamaños y extras, cocina e inventario.'
WHERE "id" = 'pizza' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Taquería / antojitos: alta rotación, pedidos al momento, mesas opcionales y propinas.'
WHERE "id" = 'tacos' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Barbería / estética: citas por colaborador, servicios con duración, comisiones y propinas.'
WHERE "id" = 'barbershop' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Gym / fitness studio: membresías, clases, control de accesos y cobros recurrentes.'
WHERE "id" = 'fitness' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Tienda / retail: inventario, código de barras, caja rápida y promociones.'
WHERE "id" = 'retail' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Servicios / citas: agenda, anticipos, recordatorios y comisiones por colaborador.'
WHERE "id" = 'services' AND "description" IS NULL;

UPDATE "niches" SET "description" = 'Giro no clasificado: se configura a la medida. Si el negocio necesita módulos que aún no existen, se registra una solicitud de nicho.'
WHERE "id" = 'other' AND "description" IS NULL;

-- ── Nichos conocidos pero AÚN NO soportados ────────────────────────────────
-- `isActive = false` => NO aparecen como opción en el onboarding.
-- Existen para que Bunzy tenga contexto (qué necesita ese giro) y para que el
-- formulario de solicitud pueda sugerirlos. Activar uno = UPDATE isActive=true.
INSERT INTO "niches" ("id", "name", "icon", "order", "isActive", "capabilities", "description") VALUES
  ('veterinary', 'Veterinaria', 'paw', 201, false,
   '{"supported":false,"needs":["appointments","medicalRecords","inventory","recurring"]}'::jsonb,
   'Clínica veterinaria: expediente por mascota, citas, vacunas, inventario de medicamentos y cobros recurrentes.'),
  ('pharmacy', 'Farmacia', 'pill', 202, false,
   '{"supported":false,"needs":["barcode","inventory","prescriptions","expiry"]}'::jsonb,
   'Farmacia: venta por código de barras, inventario con caducidades, recetas y control de lotes.'),
  ('laundry', 'Lavandería', 'washing-machine', 203, false,
   '{"supported":false,"needs":["orders","tickets","pickupDelivery"]}'::jsonb,
   'Lavandería: órdenes por ticket, cálculo por kilo o pieza, entrega y recolección.'),
  ('hotel', 'Hotel / Hospedaje', 'bed', 204, false,
   '{"supported":false,"needs":["reservations","rooms","checkin","charges"]}'::jsonb,
   'Hotel / hospedaje: habitaciones, reservas, check-in/out y cargos a la cuenta.'),
  ('florist', 'Florería', 'flower', 205, false,
   '{"supported":false,"needs":["catalog","delivery","customOrders"]}'::jsonb,
   'Florería: catálogo con arreglos, pedidos personalizados, fechas de entrega y domicilio.'),
  ('hardware', 'Ferretería', 'wrench', 206, false,
   '{"supported":false,"needs":["inventory","barcode","quotes","credit"]}'::jsonb,
   'Ferretería: inventario por medida/unidad, cotizaciones, crédito a clientes y código de barras.'),
  ('stationery', 'Papelería', 'pen', 207, false,
   '{"supported":false,"needs":["inventory","barcode","printing","schoolSeason"]}'::jsonb,
   'Papelería: inventario, copias/impresión, temporada escolar y venta por pieza.'),
  ('automotive', 'Taller mecánico', 'car', 208, false,
   '{"supported":false,"needs":["workOrders","quotes","parts","appointments"]}'::jsonb,
   'Taller mecánico: órdenes de trabajo, cotizaciones, refacciones y citas por vehículo.'),
  ('pet_grooming', 'Estética canina', 'paw', 209, false,
   '{"supported":false,"needs":["appointments","services","recurring"]}'::jsonb,
   'Estética canina: citas por mascota, paquetes de servicio y recordatorios recurrentes.'),
  ('coworking', 'Coworking / Oficinas', 'building', 210, false,
   '{"supported":false,"needs":["memberships","reservations","access"]}'::jsonb,
   'Coworking: planes y membresías, reserva de salas y control de accesos.')
ON CONFLICT ("id") DO NOTHING;

-- 'other' se queda ACTIVO en el catálogo por compatibilidad: la UI nueva lo
-- filtra del grid y ofrece la captura ("No veo mi tipo de negocio"). Así, antes
-- del deploy, el onboarding anterior sigue mostrando "Otro" sin huecos.

-- ── Solicitudes de nicho ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "niche_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- id del catálogo si se reconoció (puede ser un nicho inactivo) o NULL.
  "niche" text,
  -- Cómo nombró el usuario su giro (texto libre, recortado).
  "nicheLabel" text NOT NULL,
  "businessName" text,
  "contactName" text,
  "email" text NOT NULL,
  -- E.164 sin '+' (ej. 523221234567). Nunca se guarda en claro nada más.
  "phone" text NOT NULL,
  "message" text,
  "source" text NOT NULL DEFAULT 'onboarding',
  -- PENDING | CONTACTED | LAUNCHED | DISCARDED
  "status" text NOT NULL DEFAULT 'PENDING',
  "userId" uuid,
  "createdAt" timestamp DEFAULT now(),
  -- Cuándo salió el correo de bienvenida (NULL = no se pudo enviar).
  "notifiedAt" timestamp,
  "emailId" text
);

CREATE INDEX IF NOT EXISTS "niche_requests_email_idx" ON "niche_requests" ("email");
CREATE INDEX IF NOT EXISTS "niche_requests_status_idx" ON "niche_requests" ("status", "createdAt");
