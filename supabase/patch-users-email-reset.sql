-- Parche: email y tokens de reset de contraseña en users
-- Ejecutar en SQL Editor de Supabase si la tabla users ya existe

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token) WHERE reset_token IS NOT NULL;

COMMENT ON COLUMN users.email IS 'Correo para recuperación de contraseña (opcional)';
COMMENT ON COLUMN users.reset_token IS 'Token temporal para reset de contraseña';
COMMENT ON COLUMN users.reset_token_expires IS 'Vencimiento del token de reset';
