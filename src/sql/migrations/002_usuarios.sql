-- migrations/002_usuarios.sql
-- Objetivo: tabela de usuários (consolida registeredUsers + userPermissions do Firebase)

CREATE TABLE IF NOT EXISTS usuarios (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                  VARCHAR(150)  NOT NULL,
  email                 VARCHAR(200)  NOT NULL UNIQUE,
  senha_hash            VARCHAR(255)  NOT NULL,
  perfil                VARCHAR(30)   NOT NULL DEFAULT 'padrao'
                                      CHECK (perfil IN ('administrador','ti','gestor','padrao','visitante','cliente')),
  acesso_configuracoes  BOOLEAN       NOT NULL DEFAULT FALSE,
  acesso_controles      BOOLEAN       NOT NULL DEFAULT FALSE,
  ativo                 BOOLEAN       NOT NULL DEFAULT TRUE,
  precisa_trocar_senha  BOOLEAN       NOT NULL DEFAULT FALSE,
  ultimo_acesso         TIMESTAMP,
  criado_por            UUID          REFERENCES usuarios(id),
  atualizado_por        UUID          REFERENCES usuarios(id),
  deletado_por          UUID          REFERENCES usuarios(id),
  created_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email  ON usuarios(email)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios(perfil) WHERE deleted_at IS NULL;

COMMENT ON TABLE usuarios IS 'Usuários do R2DN. Perfil + flags de acesso a Configurações/Controles. Soft delete.';

INSERT INTO schema_migrations (versao, descricao, executado_em)
VALUES ('002', 'criar_tabela_usuarios', NOW())
ON CONFLICT (versao) DO NOTHING;
