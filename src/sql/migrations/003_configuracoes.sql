-- migrations/003_configuracoes.sql
-- Objetivo: configurações globais do sistema (singleton — ex settings/global do Firebase)

CREATE TABLE IF NOT EXISTS configuracoes (
  id                            INTEGER      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  client_identification         VARCHAR(200) NOT NULL DEFAULT '',
  corporate_identity            VARCHAR(200) NOT NULL DEFAULT '',
  control_numbering_prefix      VARCHAR(30)  NOT NULL DEFAULT 'COT-2026-',
  default_project_name          VARCHAR(200) NOT NULL DEFAULT '',
  last_quote_number             INTEGER      NOT NULL DEFAULT 0,
  last_control_number           INTEGER      NOT NULL DEFAULT 0,
  hide_total_costs_chart        BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_by_cheapest              BOOLEAN      NOT NULL DEFAULT FALSE,
  prazo_compras                 INTEGER      NOT NULL DEFAULT 3,
  prazo_contratos               INTEGER      NOT NULL DEFAULT 5,
  alcada_gerenciadora_max_valor NUMERIC(12,2) NOT NULL DEFAULT 2000,
  dashboard_export_filename     VARCHAR(300) NOT NULL DEFAULT '{{NUMERO}} - {{TITULO}} - {{DATA}}',
  purchase_order_filename       VARCHAR(300) NOT NULL DEFAULT 'Pedido de compras - {{FORNECEDOR}} - {{NUMERO}}',
  supplier_info_text_1          TEXT         NOT NULL DEFAULT '',
  supplier_info_text_2          TEXT         NOT NULL DEFAULT '',
  cno                           VARCHAR(60)  NOT NULL DEFAULT '',
  control_access_emails         TEXT         NOT NULL DEFAULT '',
  pending_access_emails         TEXT         NOT NULL DEFAULT '',
  warning_text_template         TEXT         NOT NULL DEFAULT '',
  email_template                TEXT         NOT NULL DEFAULT '',
  logo_url                      TEXT         NOT NULL DEFAULT '',
  logo_height                   INTEGER      NOT NULL DEFAULT 42,
  atualizado_por                UUID         REFERENCES usuarios(id),
  created_at                    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Garante a existência da linha singleton
INSERT INTO configuracoes (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE configuracoes IS 'Configurações globais do R2DN (linha única, id=1).';

INSERT INTO schema_migrations (versao, descricao, executado_em)
VALUES ('003', 'criar_tabela_configuracoes', NOW())
ON CONFLICT (versao) DO NOTHING;
