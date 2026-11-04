-- FinTrack — parche 018: Row Level Security en todas las tablas (auditoría de seguridad).
--
-- Por qué: Supabase publica las tablas de `public` por su API REST (PostgREST) a los roles `anon`
-- y `authenticated`. FinTrack no usa esa API: todo pasa por el backend (Express) con su propia
-- sesión. Con RLS activo y sin políticas, esos roles no ven ni cambian ninguna fila, aunque alguien
-- tenga la clave anónima del proyecto. El aislamiento por usuario lo sigue haciendo el backend
-- (cada consulta filtra por usuario_id).
--
-- El backend no se frena: se conecta con el rol dueño de las tablas y sin FORCE ROW LEVEL SECURITY
-- RLS no aplica al dueño. Por seguridad solo se activa en las tablas cuyo dueño es el rol que corre
-- el parche (o si es superusuario); así nunca deja al backend sin acceso a sus propios datos.
--
-- Idempotente. El backend lo aplica solo al arrancar (backend/src/config/migrations.js).

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
