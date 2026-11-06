import { pool } from './db.js';

/**
 * Parches de esquema para bases ya creadas (Supabase y volúmenes locales existentes).
 * Son el mismo SQL que `db/patches/`; las bases nuevas ya los traen en `db/init/`.
 * Todos son idempotentes, así que correrlos en cada arranque no cambia nada si ya están.
 * Para agregar uno: escribir `db/patches/NNN_*.sql` y copiar aquí sus sentencias.
 */
export const MIGRATIONS = [
  {
    id: '001_transacciones_local_id',
    statements: [
      'ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS local_id VARCHAR(64) NULL',
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_transacciones_usuario_local
         ON transacciones(usuario_id, local_id) WHERE local_id IS NOT NULL`,
    ],
  },
  {
    id: '002_usuarios_nombre',
    statements: ['ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre VARCHAR(60) NULL'],
  },
  {
    id: '003_usuarios_reminder_times',
    statements: [
      "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reminder_times TIME[] NOT NULL DEFAULT '{}'",
      `UPDATE usuarios
          SET reminder_times = ARRAY[reminder_time], reminder_time = NULL
        WHERE reminder_time IS NOT NULL`,
    ],
  },
  {
    id: '004_password_reset_tokens',
    statements: [
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         token_hash VARCHAR(64) UNIQUE NOT NULL,
         expires_at TIMESTAMPTZ NOT NULL,
         used_at TIMESTAMPTZ NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_usuario
         ON password_reset_tokens(usuario_id)`,
    ],
  },
  {
    id: '005_categorias_propias',
    statements: [
      `DO $$
       BEGIN
         IF (SELECT data_type FROM information_schema.columns
              WHERE table_name = 'categorias' AND column_name = 'id') = 'smallint' THEN
           ALTER TABLE transacciones ALTER COLUMN categoria_id TYPE INTEGER;
           ALTER TABLE presupuestos ALTER COLUMN categoria_id TYPE INTEGER;
           ALTER TABLE categorias ALTER COLUMN id TYPE INTEGER;
         END IF;
       END $$`,
      'CREATE SEQUENCE IF NOT EXISTS categorias_id_seq START 1000 OWNED BY categorias.id',
      "ALTER TABLE categorias ALTER COLUMN id SET DEFAULT nextval('categorias_id_seq')",
      'ALTER TABLE categorias ADD COLUMN IF NOT EXISTS usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE',
      'ALTER TABLE categorias ADD COLUMN IF NOT EXISTS icono VARCHAR(30) NULL',
      'ALTER TABLE categorias ADD COLUMN IF NOT EXISTS color VARCHAR(20) NULL',
      'ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nombre_key',
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_categorias_usuario_nombre
         ON categorias (COALESCE(usuario_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre))`,
      `CREATE INDEX IF NOT EXISTS idx_categorias_usuario
         ON categorias(usuario_id) WHERE usuario_id IS NOT NULL`,
    ],
  },
  {
    id: '006_insights_por_semana',
    statements: [
      `DO $$
       BEGIN
         IF (SELECT data_type FROM information_schema.columns
              WHERE table_name = 'insights' AND column_name = 'mes') = 'character' THEN
           ALTER TABLE insights ALTER COLUMN mes TYPE VARCHAR(10);
         END IF;
       END $$`,
    ],
  },
  {
    id: '007_vacas',
    statements: [
      `CREATE TABLE IF NOT EXISTS vacas (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         nombre VARCHAR(60) NOT NULL,
         descripcion VARCHAR(200) NULL,
         meta NUMERIC(12,2) NOT NULL CHECK (meta > 0),
         fecha_limite DATE NULL,
         reparto VARCHAR(15) NOT NULL DEFAULT 'igual' CHECK (reparto IN ('igual','personalizado')),
         codigo VARCHAR(8) UNIQUE NOT NULL,
         creador_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         consejo TEXT NULL,
         consejo_total NUMERIC(12,2) NULL,
         consejo_at TIMESTAMPTZ NULL,
         recordatorio_at TIMESTAMPTZ NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS vaca_miembros (
         vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         rol VARCHAR(10) NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin','miembro')),
         cuota NUMERIC(12,2) NULL CHECK (cuota IS NULL OR cuota >= 0),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (vaca_id, usuario_id)
       )`,
      'CREATE INDEX IF NOT EXISTS idx_vaca_miembros_usuario ON vaca_miembros(usuario_id)',
      `CREATE TABLE IF NOT EXISTS vaca_invitaciones (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
         email VARCHAR(255) NOT NULL,
         invitado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         enviada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_vaca_invitaciones_email
         ON vaca_invitaciones(vaca_id, lower(email))`,
      `CREATE TABLE IF NOT EXISTS vaca_aportes (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
         usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
         nota VARCHAR(120) NULL,
         fecha DATE NOT NULL,
         transaccion_id UUID NULL REFERENCES transacciones(id) ON DELETE SET NULL,
         local_id VARCHAR(64) NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         deleted_at TIMESTAMPTZ NULL
       )`,
      'CREATE INDEX IF NOT EXISTS idx_vaca_aportes_vaca ON vaca_aportes(vaca_id, created_at DESC)',
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_vaca_aportes_usuario_local
         ON vaca_aportes(usuario_id, local_id) WHERE local_id IS NOT NULL`,
    ],
  },
  {
    id: '008_negocios',
    statements: [
      `CREATE TABLE IF NOT EXISTS negocios (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         nombre VARCHAR(60) NOT NULL,
         descripcion VARCHAR(200) NULL,
         nit VARCHAR(20) NULL,
         codigo VARCHAR(8) UNIQUE NOT NULL,
         creador_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS negocio_socios (
         negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         rol VARCHAR(10) NOT NULL DEFAULT 'editor' CHECK (rol IN ('dueno','editor','lector')),
         participacion NUMERIC(5,2) NULL
           CHECK (participacion IS NULL OR (participacion >= 0 AND participacion <= 100)),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (negocio_id, usuario_id)
       )`,
      'CREATE INDEX IF NOT EXISTS idx_negocio_socios_usuario ON negocio_socios(usuario_id)',
      `CREATE TABLE IF NOT EXISTS negocio_invitaciones (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
         email VARCHAR(255) NOT NULL,
         rol VARCHAR(10) NOT NULL DEFAULT 'editor' CHECK (rol IN ('dueno','editor','lector')),
         invitado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         enviada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_negocio_invitaciones_email
         ON negocio_invitaciones(negocio_id, lower(email))`,
    ],
  },
  {
    id: '009_ideas',
    statements: [
      `CREATE TABLE IF NOT EXISTS ideas (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         titulo VARCHAR(120) NOT NULL,
         estado VARCHAR(12) NOT NULL DEFAULT 'revision'
           CHECK (estado IN ('revision','planeada','en_progreso','lista','descartada')),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      'CREATE INDEX IF NOT EXISTS idx_ideas_estado ON ideas(estado)',
      'CREATE INDEX IF NOT EXISTS idx_ideas_usuario ON ideas(usuario_id, created_at DESC)',
      `CREATE TABLE IF NOT EXISTS idea_votos (
         idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (idea_id, usuario_id)
       )`,
    ],
  },
  {
    id: '010_whatsapp',
    statements: [
      `CREATE TABLE IF NOT EXISTS whatsapp_vinculos (
         usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
         telefono VARCHAR(20) UNIQUE NULL,
         codigo_hash VARCHAR(64) UNIQUE NULL,
         codigo_expira TIMESTAMPTZ NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
         mensaje_id VARCHAR(128) PRIMARY KEY,
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_usuario
         ON whatsapp_mensajes(usuario_id, created_at DESC)`,
    ],
  },
  {
    id: '011_mi_plata',
    statements: [
      `CREATE TABLE IF NOT EXISTS perfiles_financieros (
         usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
         tipo_ingreso VARCHAR(10) NULL CHECK (tipo_ingreso IN ('fecha_fija','sin_fecha')),
         dias_pago SMALLINT[] NOT NULL DEFAULT '{}',
         saldo_inicial NUMERIC(12,2) NULL CHECK (saldo_inicial IS NULL OR saldo_inicial >= 0),
         saldo_at TIMESTAMPTZ NULL,
         bienvenida_at TIMESTAMPTZ NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS compromisos (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         nombre VARCHAR(60) NOT NULL,
         monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
         dia_mes SMALLINT NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_compromisos_usuario_nombre
         ON compromisos(usuario_id, lower(nombre))`,
    ],
  },
  {
    id: '012_saldo_corregido',
    statements: [
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name = 'perfiles_financieros' AND column_name = 'saldo_corregido') THEN
           ALTER TABLE perfiles_financieros ADD COLUMN saldo_corregido BOOLEAN NOT NULL DEFAULT false;
           UPDATE perfiles_financieros p SET saldo_corregido = true
            WHERE p.saldo_inicial IS NOT NULL AND COALESCE((
              SELECT SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto ELSE -t.monto END)
                FROM transacciones t WHERE t.usuario_id = p.usuario_id AND t.deleted_at IS NULL), 0) <= 0;
         END IF;
       END $$`,
    ],
  },
  {
    id: '013_verificar_correo',
    statements: [
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name = 'usuarios' AND column_name = 'email_verificado_at') THEN
           ALTER TABLE usuarios ADD COLUMN email_verificado_at TIMESTAMPTZ NULL;
           UPDATE usuarios SET email_verificado_at = now();
         END IF;
       END $$`,
      `CREATE TABLE IF NOT EXISTS email_verification_tokens (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         token_hash VARCHAR(64) UNIQUE NOT NULL,
         expires_at TIMESTAMPTZ NOT NULL,
         used_at TIMESTAMPTZ NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_usuario
         ON email_verification_tokens(usuario_id)`,
    ],
  },
  {
    id: '014_tarjetas',
    statements: [
      `CREATE TABLE IF NOT EXISTS tarjetas (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         nombre VARCHAR(40) NOT NULL,
         franquicia VARCHAR(10) NOT NULL CHECK (franquicia IN ('visa','mastercard','amex','otra')),
         nivel VARCHAR(10) NOT NULL,
         ultimos4 CHAR(4) NOT NULL CHECK (ultimos4 ~ '^[0-9]{4}$'),
         cupo_total NUMERIC(12,2) NOT NULL CHECK (cupo_total > 0),
         deuda_base NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deuda_base >= 0), -- deuda al crearla o ajustarla
         base_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- desde cuándo cuentan los cargos y pagos sobre deuda_base
         dia_pago SMALLINT NOT NULL CHECK (dia_pago BETWEEN 1 AND 31),
         dia_corte SMALLINT NULL CHECK (dia_corte BETWEEN 1 AND 31),
         total_extracto NUMERIC(12,2) NULL CHECK (total_extracto >= 0),
         fecha_limite_extracto DATE NULL,
         recordatorio_enviado_para DATE NULL, -- fecha de pago ya avisada: evita repetir el push
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         deleted_at TIMESTAMPTZ NULL,
         CONSTRAINT tarjetas_nivel_check CHECK (
           (franquicia IN ('visa','mastercard') AND nivel IN ('clasica','gold','platinum','black'))
           OR (franquicia = 'amex' AND nivel IN ('green','blue','gold','platinum'))
           OR (franquicia = 'otra' AND nivel = 'clasica'))
       )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_tarjetas_usuario_ultimos4
         ON tarjetas(usuario_id, ultimos4) WHERE deleted_at IS NULL`,
      `ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS tarjeta_id UUID NULL REFERENCES tarjetas(id)`,
      `ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS cuotas SMALLINT NULL CHECK (cuotas BETWEEN 1 AND 48)`,
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacciones_tarjeta_solo_gasto') THEN
           ALTER TABLE transacciones ADD CONSTRAINT transacciones_tarjeta_solo_gasto
             CHECK (tarjeta_id IS NULL OR tipo = 'gasto');
         END IF;
       END $$`,
      `CREATE INDEX IF NOT EXISTS idx_transacciones_tarjeta
         ON transacciones(tarjeta_id) WHERE deleted_at IS NULL`,
      `CREATE TABLE IF NOT EXISTS pagos_tarjeta (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         tarjeta_id UUID NOT NULL REFERENCES tarjetas(id),
         monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
         fecha DATE NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         deleted_at TIMESTAMPTZ NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_pagos_tarjeta_tarjeta
         ON pagos_tarjeta(tarjeta_id) WHERE deleted_at IS NULL`,
      `CREATE TABLE IF NOT EXISTS ajustes_tarjeta (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         tarjeta_id UUID NOT NULL REFERENCES tarjetas(id),
         diferencia NUMERIC(12,2) NOT NULL CHECK (diferencia <> 0),
         transaccion_id UUID NULL REFERENCES transacciones(id), -- gasto creado cuando el banco cobró de más
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_ajustes_tarjeta_tarjeta ON ajustes_tarjeta(tarjeta_id)`,
      `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recordar_tarjetas BOOLEAN NOT NULL DEFAULT true`,
    ],
  },
  {
    id: '015_soportes',
    statements: [
      `CREATE TABLE IF NOT EXISTS transaccion_soportes (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         transaccion_id UUID NOT NULL REFERENCES transacciones(id) ON DELETE CASCADE,
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         nombre VARCHAR(120) NOT NULL,
         tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('image/jpeg','image/png','image/webp','application/pdf')),
         tamano INTEGER NOT NULL CHECK (tamano > 0),
         ruta VARCHAR(200) UNIQUE NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_transaccion_soportes_transaccion
         ON transaccion_soportes(transaccion_id, created_at)`,
    ],
  },
  {
    id: '016_notificaciones',
    statements: [
      `CREATE TABLE IF NOT EXISTS notificaciones (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         titulo VARCHAR(120) NOT NULL,
         cuerpo VARCHAR(300) NOT NULL,
         url VARCHAR(200) NULL,
         leida_at TIMESTAMPTZ NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, created_at DESC)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_alertas_presupuesto_nivel ON alertas(presupuesto_id, nivel)`,
    ],
  },
  {
    id: '017_cuentas_personales',
    statements: [
      `CREATE TABLE IF NOT EXISTS cuentas_personales (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
       tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('por_cobrar', 'por_pagar')),
       persona VARCHAR(60) NOT NULL,
       monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
       fecha_limite DATE NULL,
       nota VARCHAR(200) NULL,
       saldada_at TIMESTAMPTZ NULL,
       transaccion_id UUID NULL REFERENCES transacciones(id) ON DELETE SET NULL,
       recordatorio_enviado BOOLEAN NOT NULL DEFAULT false, -- ya se avisó un día antes de fecha_limite
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_cuentas_personales_usuario
         ON cuentas_personales(usuario_id, saldada_at, fecha_limite)`,
    ],
  },
  {
    id: '018_pagos_por_confirmar',
    statements: [
      `CREATE TABLE IF NOT EXISTS atajo_tokens (
         usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
         token_hash CHAR(64) NOT NULL UNIQUE,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         usado_at TIMESTAMPTZ NULL
       )`,
      `CREATE TABLE IF NOT EXISTS pagos_por_confirmar (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
         comercio VARCHAR(80) NOT NULL,
         monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
         fecha DATE NOT NULL,
         tarjeta VARCHAR(40) NULL,
         llave CHAR(64) NOT NULL,
         estado VARCHAR(11) NOT NULL DEFAULT 'pendiente'
           CHECK (estado IN ('pendiente', 'confirmado', 'descartado')),
         transaccion_id UUID NULL REFERENCES transacciones(id) ON DELETE SET NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         UNIQUE (usuario_id, llave)
       )`,
      `CREATE INDEX IF NOT EXISTS idx_pagos_por_confirmar_usuario
         ON pagos_por_confirmar(usuario_id, estado, created_at DESC)`,
    ],
  },
  {
    id: '019_negocio_movimientos',
    statements: [
      `CREATE TABLE IF NOT EXISTS negocio_movimientos (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
         usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
         tipo VARCHAR(14) NOT NULL
           CHECK (tipo IN ('venta', 'costo_venta', 'gasto_fijo', 'gasto_variable', 'otro_ingreso')),
         categoria VARCHAR(20) NOT NULL,
         monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
         descripcion VARCHAR(120) NOT NULL,
         fecha DATE NOT NULL,
         local_id UUID NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_negocio_movimientos_fecha ON negocio_movimientos(negocio_id, fecha DESC)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_negocio_movimientos_local
         ON negocio_movimientos(negocio_id, local_id) WHERE local_id IS NOT NULL`,
    ],
  },
  {
    id: '020_retiros_socios',
    statements: [
      `ALTER TABLE negocio_movimientos DROP CONSTRAINT IF EXISTS negocio_movimientos_tipo_check`,
      `ALTER TABLE negocio_movimientos ADD CONSTRAINT negocio_movimientos_tipo_check
         CHECK (tipo IN ('venta', 'costo_venta', 'gasto_fijo', 'gasto_variable', 'otro_ingreso', 'retiro'))`,
      `ALTER TABLE negocio_movimientos ADD COLUMN IF NOT EXISTS transaccion_id UUID NULL
         REFERENCES transacciones(id) ON DELETE SET NULL`,
    ],
  },
  {
    id: '021_vacas_personales',
    statements: [
      `ALTER TABLE vacas ADD COLUMN IF NOT EXISTS personal BOOLEAN NOT NULL DEFAULT false`,
    ],
  },
];

/**
 * Row Level Security en todas las tablas de `public` (ver db/patches/999_rls.sql): la API REST de
 * Supabase no expone nada y el backend, dueño de las tablas, no se ve afectado. No va en
 * MIGRATIONS sino que `runMigrations` lo corre siempre al final: así cubre también las tablas de
 * cualquier parche que se agregue después, sin depender del orden de la lista.
 */
export const RLS_STATEMENT = `DO $$
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
END $$;`;

/**
 * Aplica los parches pendientes antes de atender peticiones y, al final, RLS en todas las tablas.
 * Si la base todavía no tiene el esquema (p. ej. una base vacía en CI) no hace nada: eso lo crea
 * `db/init/`.
 * @param {import('pg').Pool} [db]
 * @returns {Promise<string[]>} Ids de los parches revisados, o `[]` si no hay esquema.
 */
export async function runMigrations(db = pool) {
  const { rows } = await db.query("SELECT to_regclass('public.usuarios') AS tabla");
  if (!rows[0].tabla) return [];
  for (const { statements } of MIGRATIONS) {
    for (const sql of statements) await db.query(sql);
  }
  await db.query(RLS_STATEMENT);
  return MIGRATIONS.map((m) => m.id);
}
