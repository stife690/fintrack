-- FinTrack — esquema de la base de datos (Modelo Relacional v2.0, 28/09/2026).
-- Postgres ejecuta este archivo solo la PRIMERA vez que se crea el volumen.
-- Para reiniciar la base desde cero: docker compose down -v && docker compose up -d db

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
  reminder_time TIME NULL,
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

CREATE TABLE categorias (
  id SMALLINT PRIMARY KEY,
  key VARCHAR(30) UNIQUE NOT NULL,
  nombre VARCHAR(50) UNIQUE NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','gasto'))
);

CREATE TABLE transacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id SMALLINT REFERENCES categorias(id),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  descripcion TEXT NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  fecha DATE NOT NULL,
  origen VARCHAR(15) NOT NULL CHECK (origen IN ('manual','ia','sin_clasificar')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_transacciones_usuario_fecha
  ON transacciones(usuario_id, fecha DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transacciones_usuario_cat_fecha
  ON transacciones(usuario_id, categoria_id, fecha) WHERE deleted_at IS NULL;
CREATE INDEX idx_transacciones_usuario_updated
  ON transacciones(usuario_id, updated_at);

CREATE TABLE presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id SMALLINT NOT NULL REFERENCES categorias(id),
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
  mes CHAR(7) NOT NULL,
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
