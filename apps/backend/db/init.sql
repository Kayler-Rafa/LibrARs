-- Libras AR — Init SQL (roda automaticamente no primeiro start do Postgres)
-- Este arquivo é executado automaticamente DENTRO do database especificado em POSTGRES_DB

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Usuários
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        UNIQUE NOT NULL,
  password_hash TEXT      NOT NULL,
  name        TEXT        NOT NULL DEFAULT '',
  role         TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_student   BOOLEAN     NOT NULL DEFAULT false,
  has_disability BOOLEAN   NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gestos de cada usuário
CREATE TABLE IF NOT EXISTS gestures (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  samples          JSONB       NOT NULL DEFAULT '[]', -- amostras comprimidas (para classificação)
  samples_raw      JSONB       NOT NULL DEFAULT '[]', -- amostras originais brutas (para pesquisa)
  samples_temporal JSONB       NOT NULL DEFAULT '[]', -- vetor temporal 252-dim pré-computado
  sample_count INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_gestures_user_id ON gestures(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_gestures_created_at ON gestures(created_at DESC);

-- Tokens de convite gerados pelo admin
CREATE TABLE IF NOT EXISTS invite_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tokens de reset de senha gerados pelo admin
CREATE TABLE IF NOT EXISTS reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gestures_set_updated_at ON gestures;
CREATE TRIGGER gestures_set_updated_at
  BEFORE UPDATE ON gestures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger: primeiro usuário registrado se torna admin
CREATE OR REPLACE FUNCTION set_first_user_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM users WHERE role = 'admin') = 0 THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_first_admin ON users;
CREATE TRIGGER users_set_first_admin
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION set_first_user_as_admin();
