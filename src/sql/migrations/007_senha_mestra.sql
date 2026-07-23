-- =============================================================
-- 007 — Senha Mestra (confirmação de mudanças sensíveis de status).
-- Guardada com bcrypt em configuracoes (nunca em texto puro).
-- =============================================================

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS senha_mestra_hash TEXT;
