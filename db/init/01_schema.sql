-- FinTrack — esquema de la base de datos (Modelo Relacional v2.0, 28/09/2026).
-- Postgres ejecuta este archivo solo la PRIMERA vez que se crea el volumen.
-- Para reiniciar la base desde cero: docker compose down -v && docker compose up -d db

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(60) NULL, -- nombre visible; opcional (las cuentas viejas no lo tienen)
  password_hash VARCHAR(255) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
  reminder_time TIME NULL, -- en desuso: lo reemplaza reminder_times (parche 003)
  reminder_times TIME[] NOT NULL DEFAULT '{}', -- horas locales del recordatorio diario (hasta 5)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_usuario ON refresh_tokens(usuario_id);


CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL, -- sha256 del token del enlace; el token nunca se guarda
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL, -- se llena al usarlo: cada enlace sirve una sola vez
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_reset_tokens_usuario ON password_reset_tokens(usuario_id);

-- Las 15 de db/init/02 son de todos (usuario_id NULL, ids 1-15). Cada usuario puede crear las
-- suyas (usuario_id, icono y color); su id sale de la secuencia, desde 1000.
CREATE SEQUENCE categorias_id_seq START 1000;
CREATE TABLE categorias (
  id INTEGER PRIMARY KEY DEFAULT nextval('categorias_id_seq'),
  key VARCHAR(30) UNIQUE NOT NULL,
  nombre VARCHAR(50) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  icono VARCHAR(30) NULL,
  color VARCHAR(20) NULL
);
ALTER SEQUENCE categorias_id_seq OWNED BY categorias.id;
-- El nombre es único entre las globales y entre las de cada usuario.
CREATE UNIQUE INDEX ux_categorias_usuario_nombre
  ON categorias (COALESCE(usuario_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
CREATE INDEX idx_categorias_usuario ON categorias(usuario_id) WHERE usuario_id IS NOT NULL;

CREATE TABLE transacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES categorias(id),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  descripcion TEXT NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  fecha DATE NOT NULL,
  origen VARCHAR(15) NOT NULL CHECK (origen IN ('manual','ia','sin_clasificar')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  -- Id de IndexedDB de las creadas offline: evita duplicarlas si un lote de /sync/batch se reenvía.
  local_id VARCHAR(64) NULL
);
CREATE UNIQUE INDEX ux_transacciones_usuario_local
  ON transacciones(usuario_id, local_id) WHERE local_id IS NOT NULL;
CREATE INDEX idx_transacciones_usuario_fecha
  ON transacciones(usuario_id, fecha DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transacciones_usuario_cat_fecha
  ON transacciones(usuario_id, categoria_id, fecha) WHERE deleted_at IS NULL;
CREATE INDEX idx_transacciones_usuario_updated
  ON transacciones(usuario_id, updated_at);

CREATE TABLE presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  mes CHAR(7) NOT NULL,
  monto_limite NUMERIC(12,2) NOT NULL CHECK (monto_limite > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, categoria_id, mes)
);

CREATE TABLE alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('warning_80','exceeded_100')),
  notificado_push BOOLEAN NOT NULL DEFAULT false,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Periodo de los consejos: el mes (AAAA-MM) o el lunes de la semana (AAAA-MM-DD).
  mes VARCHAR(10) NOT NULL,
  contenido JSONB NOT NULL,
  generado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, mes)
);

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La Vaca Inteligente (FT-0014): grupos con una meta común, miembros, invitaciones y aportes.
CREATE TABLE vacas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(60) NOT NULL,
  descripcion VARCHAR(200) NULL,
  meta NUMERIC(12,2) NOT NULL CHECK (meta > 0),
  fecha_limite DATE NULL,
  reparto VARCHAR(15) NOT NULL DEFAULT 'igual' CHECK (reparto IN ('igual','personalizado')),
  codigo VARCHAR(8) UNIQUE NOT NULL, -- código de invitación (enlace /app/vacas/unirse/<codigo>)
  creador_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  consejo TEXT NULL, -- último consejo generado (IA o reglas), se reutiliza mientras no cambie el total
  consejo_total NUMERIC(12,2) NULL,
  consejo_at TIMESTAMPTZ NULL,
  recordatorio_at TIMESTAMPTZ NULL, -- último recordatorio push a los atrasados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vaca_miembros (
  vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol VARCHAR(10) NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin','miembro')),
  cuota NUMERIC(12,2) NULL CHECK (cuota IS NULL OR cuota >= 0), -- solo con reparto personalizado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vaca_id, usuario_id)
);
CREATE INDEX idx_vaca_miembros_usuario ON vaca_miembros(usuario_id);

CREATE TABLE vaca_invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invitado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  enviada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_vaca_invitaciones_email ON vaca_invitaciones(vaca_id, lower(email));

-- Cada aporte también queda como un gasto del miembro (transaccion_id). Si el miembro borra su
-- cuenta, el aporte se conserva para el total del grupo (usuario_id queda en NULL).
CREATE TABLE vaca_aportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaca_id UUID NOT NULL REFERENCES vacas(id) ON DELETE CASCADE,
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  nota VARCHAR(120) NULL,
  fecha DATE NOT NULL,
  transaccion_id UUID NULL REFERENCES transacciones(id) ON DELETE SET NULL,
  local_id VARCHAR(64) NULL, -- id del dispositivo: reenviar un aporte hecho sin conexión no lo duplica
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_vaca_aportes_vaca ON vaca_aportes(vaca_id, created_at DESC);
CREATE UNIQUE INDEX ux_vaca_aportes_usuario_local
  ON vaca_aportes(usuario_id, local_id) WHERE local_id IS NOT NULL;

-- Emprendimientos (FT-0016): negocios que comparten varias personas, sus socios e invitaciones.
CREATE TABLE negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(60) NOT NULL,
  descripcion VARCHAR(200) NULL,
  nit VARCHAR(20) NULL,
  codigo VARCHAR(8) UNIQUE NOT NULL, -- código de invitación (enlace /app/negocios/unirse/<codigo>)
  creador_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- dueño: administra el negocio y sus socios · editor: registra movimientos · lector: solo ve.
CREATE TABLE negocio_socios (
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol VARCHAR(10) NOT NULL DEFAULT 'editor' CHECK (rol IN ('dueno','editor','lector')),
  participacion NUMERIC(5,2) NULL CHECK (participacion IS NULL OR (participacion >= 0 AND participacion <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (negocio_id, usuario_id)
);
CREATE INDEX idx_negocio_socios_usuario ON negocio_socios(usuario_id);

-- El rol con el que entra quien acepta la invitación por correo.
CREATE TABLE negocio_invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  rol VARCHAR(10) NOT NULL DEFAULT 'editor' CHECK (rol IN ('dueno','editor','lector')),
  invitado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  enviada_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_negocio_invitaciones_email ON negocio_invitaciones(negocio_id, lower(email));

-- Lo que viene (FT-0026). revision: solo la ve el equipo · planeada y en_progreso: públicas, se
-- votan · lista: ya disponible · descartada: no se muestra. El equipo cambia el estado con SQL.
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo VARCHAR(120) NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'revision'
    CHECK (estado IN ('revision','planeada','en_progreso','lista','descartada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ideas_estado ON ideas(estado);
CREATE INDEX idx_ideas_usuario ON ideas(usuario_id, created_at DESC);

-- Un voto por persona: la llave primaria impide votar dos veces.
CREATE TABLE idea_votos (
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, usuario_id)
);
