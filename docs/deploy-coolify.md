# Deploy no Coolify

O Vértice tem dois ambientes **estruturalmente independentes** no Coolify. Cada um deve ser uma aplicação distinta, com histórico de deploy, domínio, variáveis, banco e volumes próprios.

| Ambiente | Branch | Domínio |
| --- | --- | --- |
| Produção | `main` | `vertice.teralabs.cloud` |
| Staging / homologação | `develop` | `dev.vertice.teralabs.cloud` |

## Configuração obrigatória no Coolify

### Produção

- Aplicação independente: `vertice`.
- Repositório: `canhetejr/vertice`.
- Branch: `main` **somente**.
- Domínio exclusivo: `https://vertice.teralabs.cloud`.
- Deploy automático/webhook habilitado apenas para commits em `main`.
- Variáveis próprias de produção; as `NEXT_PUBLIC_*` necessárias ao build devem estar marcadas como **build-time** e runtime.

### Staging

- Aplicação independente: `vertice-dev`.
- Repositório: `canhetejr/vertice`.
- Branch: `develop` **somente**.
- Domínio exclusivo: `https://dev.vertice.teralabs.cloud`.
- Deploy automático/webhook habilitado apenas para commits em `develop`.
- Variáveis próprias de staging; `NEXT_PUBLIC_APP_URL` deve ser `https://dev.vertice.teralabs.cloud`, marcada como **build-time** e runtime.

## Isolamento obrigatório

Nunca compartilhe entre os ambientes:

- banco de dados ou projeto Supabase de produção;
- credenciais, chaves de serviço, `CRON_SECRET`, tokens Google ou segredos de e-mail de produção;
- volumes persistentes, uploads, filas ou storage;
- domínio, container ou aplicação Coolify.

Se staging executar rotinas agendadas, use dados e credenciais exclusivamente de staging. Antes de promover uma mudança, valide migrações em staging e tenha backup/restauração testada do banco de produção.

## Docker e saúde

O build usa o `Dockerfile` do repositório com Node 22 e `npm ci` seguido de `npm run build`. O container atende na porta `3000`; mantenha o health check HTTP ativo. Depois de cada deploy, confirme: deployment concluído, status `running:healthy`, commit esperado e HTTP 200 no domínio correto.

## Rollback

Para rollback, selecione no Coolify um commit/imagem anteriormente saudável da **mesma aplicação e ambiente**. Não use uma imagem, volume ou variável do outro ambiente como atalho.
