CREATE TABLE user_provider_api_keys (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, provider)
);

CREATE INDEX idx_user_provider_api_keys_user_id
  ON user_provider_api_keys(user_id);

INSERT INTO user_provider_api_keys (
  user_id,
  provider,
  api_key_encrypted,
  key_version,
  created_at,
  updated_at
)
SELECT
  user_id,
  provider,
  api_key_encrypted,
  key_version,
  created_at,
  updated_at
FROM user_settings;

CREATE TABLE user_settings_next (
  user_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  model_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO user_settings_next (
  user_id,
  provider,
  model_id,
  created_at,
  updated_at
)
SELECT
  user_id,
  provider,
  COALESCE(model_id, ''),
  created_at,
  updated_at
FROM user_settings;

DROP TABLE user_settings;

ALTER TABLE user_settings_next RENAME TO user_settings;
