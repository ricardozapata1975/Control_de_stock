PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contenedores (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  almacen TEXT NOT NULL DEFAULT 'ALM01',
  armario TEXT NOT NULL,
  estante TEXT NOT NULL,
  contenedor TEXT,
  ubicacion TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contenedores_almacen ON contenedores(almacen);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  marca TEXT DEFAULT '',
  modelo TEXT DEFAULT '',
  tipo TEXT DEFAULT '',
  detalle TEXT DEFAULT '',
  calibracion TEXT DEFAULT '',
  comentario TEXT DEFAULT '',
  fecha_relevamiento TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  contenedor_id TEXT NOT NULL REFERENCES contenedores(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (item_id, contenedor_id)
);

CREATE TABLE IF NOT EXISTS movimientos (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  contenedor_id TEXT NOT NULL REFERENCES contenedores(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('egreso', 'ingreso')),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  usuario TEXT NOT NULL,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  offline_id TEXT UNIQUE,
  egreso_movimiento_id TEXT REFERENCES movimientos(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operario')),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  reset_token TEXT,
  reset_token_expires TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_contenedor ON stock(contenedor_id);
CREATE INDEX IF NOT EXISTS idx_stock_item ON stock(item_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos(usuario);
CREATE INDEX IF NOT EXISTS idx_movimientos_offline ON movimientos(offline_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(lower(username));

CREATE TABLE IF NOT EXISTS item_tipos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1,
  orden INTEGER
);
