-- Igual que db/patches/999_rls.sql: RLS en todas las tablas (va después del esquema y las semillas).
DO $$
DECLARE
  t record;
  superusuario boolean;
BEGIN
  SELECT rolsuper INTO superusuario FROM pg_roles WHERE rolname = current_user;
  FOR t IN
    SELECT c.relname, pg_get_userbyid(c.relowner) AS dueno
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    IF superusuario OR t.dueno = current_user THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    ELSE
      RAISE WARNING 'RLS: no se activó en % (su dueño es %, no %)', t.relname, t.dueno, current_user;
    END IF;
  END LOOP;
END $$;
