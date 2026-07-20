-- migrations/005_controles.sql
-- Objetivo: controles/demandas e seu histórico

CREATE TABLE IF NOT EXISTS controles (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                VARCHAR(40)   NOT NULL UNIQUE,
  titulo                VARCHAR(300)  NOT NULL DEFAULT '',
  filled_by             VARCHAR(150),
  data                  DATE,
  status                VARCHAR(40)   NOT NULL DEFAULT 'Rascunho'
                        CHECK (status IN ('Rascunho','Pendente','Pendência Fornecedor','Concluído','Em Andamento','Cancelado')),
  fill_type             VARCHAR(60),
  frozen_at             TIMESTAMP,
  frozen_remaining_days INTEGER,
  origem_created_at     TIMESTAMP,
  criado_por            UUID          REFERENCES usuarios(id),
  atualizado_por        UUID          REFERENCES usuarios(id),
  deletado_por          UUID          REFERENCES usuarios(id),
  created_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_controles_status  ON controles(status)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_controles_created ON controles(created_at DESC);

COMMENT ON TABLE controles IS 'Controles/demandas (assinatura de contrato, revisão, decisão, retorno).';

CREATE TABLE IF NOT EXISTS controle_historico (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id UUID         NOT NULL REFERENCES controles(id) ON DELETE CASCADE,
  evento_em   TIMESTAMP    NOT NULL DEFAULT NOW(),
  tipo        VARCHAR(30)  NOT NULL DEFAULT 'general'
                           CHECK (tipo IN ('creation','status_change','general')),
  usuario     VARCHAR(200),
  mensagem    TEXT
);
CREATE INDEX IF NOT EXISTS idx_ctrl_hist_controle ON controle_historico(controle_id, evento_em);

INSERT INTO schema_migrations (versao, descricao, executado_em)
VALUES ('005', 'criar_tabelas_controles', NOW())
ON CONFLICT (versao) DO NOTHING;
