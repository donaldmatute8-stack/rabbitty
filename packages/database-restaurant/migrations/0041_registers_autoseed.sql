-- 0041 · Toda sucursal nueva nace con su caja principal (MAIN)
--
-- Por qué: `registers` se sembró una vez en 0040, pero una sucursal creada
-- después (God, alta de tenant, sandbox) se quedaba sin catálogo de cajas hasta
-- el siguiente predeploy. El turno seguía funcionando con `MAIN` por defecto,
-- pero la pantalla de cajas se veía vacía.
--
-- Este trigger cubre TODOS los caminos de creación de sucursal, sin tocar cada
-- router. Es idempotente: si la sucursal ya tiene MAIN, no inserta nada.
--
-- Aditiva. No modifica sucursales ni cajas existentes.

CREATE OR REPLACE FUNCTION public.registers_seed_main()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO "registers" ("id", "branchId", "code", "name", "sortOrder")
  SELECT gen_random_uuid()::text, NEW."id", 'MAIN', 'Caja principal', 0
   WHERE NOT EXISTS (
     SELECT 1 FROM "registers" r
      WHERE r."branchId" = NEW."id" AND lower(r."code") = 'main'
   );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS "branches_seed_main_register" ON "branches";
CREATE TRIGGER "branches_seed_main_register"
  AFTER INSERT ON "branches"
  FOR EACH ROW EXECUTE FUNCTION public.registers_seed_main();
