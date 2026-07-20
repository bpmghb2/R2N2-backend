-- =============================================================
-- 006 — Chave de API (BearerAuth) para consumo externo (API v1).
-- Gerada/rotacionada nas Configurações; usada como Bearer estático.
-- =============================================================

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS api_bearer_key TEXT;
