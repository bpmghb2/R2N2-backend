-- migrations/004_cotacoes.sql
-- Objetivo: cotações e suas coleções relacionadas (normalização do modelo Firebase)

-- ============================================================
-- Cotações
-- ============================================================
CREATE TABLE IF NOT EXISTS cotacoes (
  id                              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                          VARCHAR(40)   NOT NULL UNIQUE,
  titulo                          VARCHAR(300)  NOT NULL DEFAULT '',
  data                            DATE,
  projeto_nome                    VARCHAR(200)  NOT NULL DEFAULT '',
  cliente_nome                    VARCHAR(200)  NOT NULL DEFAULT '',
  engenheiro_nome                 VARCHAR(200)  NOT NULL DEFAULT '',
  status                          VARCHAR(40)   NOT NULL DEFAULT 'Rascunho'
                                  CHECK (status IN ('Rascunho','Pendente','Aprovado','Recusado','Aguardando Fornecedor','Aprovado pela Gerenciadora')),
  format_type                     VARCHAR(20)   NOT NULL DEFAULT 'Compras'
                                  CHECK (format_type IN ('Compras','Serviço','Contratos')),
  prazo_dias                      INTEGER,
  locked                          BOOLEAN       NOT NULL DEFAULT FALSE,
  saved_to_cloud                  BOOLEAN       NOT NULL DEFAULT TRUE,
  aprovacao_data                  DATE,
  manager_choice_supplier_ref     VARCHAR(60),
  manager_choice_justificativa    TEXT,
  approved_supplier_ref           VARCHAR(60),
  approved_supplier_justificativa TEXT,
  frozen_at                       TIMESTAMP,
  frozen_remaining_days           INTEGER,
  email_sent_at                   TIMESTAMP,
  filled_by                       VARCHAR(150),
  origem_created_at               TIMESTAMP,     -- createdAt original (base do timer)
  criado_por                      UUID          REFERENCES usuarios(id),
  atualizado_por                  UUID          REFERENCES usuarios(id),
  deletado_por                    UUID          REFERENCES usuarios(id),
  created_at                      TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMP     NOT NULL DEFAULT NOW(),
  deleted_at                      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cotacoes_status  ON cotacoes(status)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cotacoes_numero  ON cotacoes(numero);
CREATE INDEX IF NOT EXISTS idx_cotacoes_created ON cotacoes(created_at DESC);

COMMENT ON TABLE cotacoes IS 'Cotações/quadros comparativos. manager/approved_supplier_ref = external_id do fornecedor dentro da cotação.';

-- ============================================================
-- Fornecedores da cotação
-- ============================================================
CREATE TABLE IF NOT EXISTS cotacao_fornecedores (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id     UUID          NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  external_id    VARCHAR(60)   NOT NULL,   -- id original (ex: sup-...) usado no mapa de preços
  nome           VARCHAR(200)  NOT NULL DEFAULT '',
  contato        VARCHAR(200),
  prazo_pagamento VARCHAR(60),
  frete          NUMERIC(12,2) NOT NULL DEFAULT 0,
  impostos       NUMERIC(12,2) NOT NULL DEFAULT 0,
  ordem          INTEGER       NOT NULL DEFAULT 0,
  created_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
  UNIQUE (cotacao_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_cot_forn_cotacao ON cotacao_fornecedores(cotacao_id);

-- ============================================================
-- Itens da cotação
-- ============================================================
CREATE TABLE IF NOT EXISTS cotacao_itens (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id   UUID          NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  external_id  VARCHAR(60)   NOT NULL,
  numero       INTEGER       NOT NULL DEFAULT 0,
  descricao    TEXT          NOT NULL DEFAULT '',
  unidade      VARCHAR(30)   NOT NULL DEFAULT 'Un',
  quantidade   NUMERIC(14,4) NOT NULL DEFAULT 0,
  ordem        INTEGER       NOT NULL DEFAULT 0,
  created_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
  UNIQUE (cotacao_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_cot_item_cotacao ON cotacao_itens(cotacao_id);

-- ============================================================
-- Preços unitários por item x fornecedor (normaliza o mapa "prices")
-- ============================================================
CREATE TABLE IF NOT EXISTS cotacao_item_precos (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID          NOT NULL REFERENCES cotacao_itens(id) ON DELETE CASCADE,
  fornecedor_id  UUID          NOT NULL REFERENCES cotacao_fornecedores(id) ON DELETE CASCADE,
  preco_unitario NUMERIC(14,4),
  UNIQUE (item_id, fornecedor_id)
);
CREATE INDEX IF NOT EXISTS idx_cot_preco_item ON cotacao_item_precos(item_id);

-- ============================================================
-- Inclusões e Exclusões
-- ============================================================
CREATE TABLE IF NOT EXISTS cotacao_inclusoes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id  UUID         NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  numero      INTEGER      NOT NULL DEFAULT 0,
  servico     TEXT         NOT NULL DEFAULT '',
  descricao   TEXT         NOT NULL DEFAULT '',
  ordem       INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cot_inc_cotacao ON cotacao_inclusoes(cotacao_id);

CREATE TABLE IF NOT EXISTS cotacao_exclusoes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id  UUID         NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  numero      INTEGER      NOT NULL DEFAULT 0,
  servico     TEXT         NOT NULL DEFAULT '',
  descricao   TEXT         NOT NULL DEFAULT '',
  ordem       INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cot_exc_cotacao ON cotacao_exclusoes(cotacao_id);

-- ============================================================
-- Histórico da cotação
-- ============================================================
CREATE TABLE IF NOT EXISTS cotacao_historico (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id    UUID         NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  evento_em     TIMESTAMP    NOT NULL DEFAULT NOW(),
  tipo          VARCHAR(30)  NOT NULL DEFAULT 'general'
                             CHECK (tipo IN ('creation','status_change','approval','unlocked','general','update')),
  from_status   VARCHAR(40),
  to_status     VARCHAR(40),
  usuario       VARCHAR(200),
  mensagem      TEXT,
  justificativa TEXT
);
CREATE INDEX IF NOT EXISTS idx_cot_hist_cotacao ON cotacao_historico(cotacao_id, evento_em);

INSERT INTO schema_migrations (versao, descricao, executado_em)
VALUES ('004', 'criar_tabelas_cotacoes', NOW())
ON CONFLICT (versao) DO NOTHING;
