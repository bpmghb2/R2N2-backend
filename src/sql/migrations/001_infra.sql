-- migrations/001_infra.sql
-- Objetivo: extensões, controle de migrations e auditoria (base do sistema R2DN)

-- Extensão para gen_random_uuid() (nativo no PG13+, garante em versões anteriores)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Controle de migrations
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  versao       VARCHAR(10)  PRIMARY KEY,
  descricao    VARCHAR(200) NOT NULL,
  executado_em TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Log de auditoria (ações dos usuários)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  acao          VARCHAR(30) NOT NULL,
  entidade      VARCHAR(50),
  entidade_id   VARCHAR(50),
  usuario_id    UUID,
  usuario_nome  VARCHAR(150),
  ip            VARCHAR(45),
  user_agent    TEXT,
  dados_antes   JSONB,
  dados_depois  JSONB,
  metadados     JSONB,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_usuario  ON audit_log(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON audit_log(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_acao     ON audit_log(acao, created_at DESC);

COMMENT ON TABLE audit_log IS 'Registro de ações relevantes dos usuários do R2DN.';

INSERT INTO schema_migrations (versao, descricao, executado_em)
VALUES ('001', 'infra: extensoes, schema_migrations, audit_log', NOW())
ON CONFLICT (versao) DO NOTHING;
