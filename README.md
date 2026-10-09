# impressione.me

Site institucional da Impressione (`https://impressione.me`): Astro estático
servido por um Cloudflare Worker, com formulário de contato que salva em D1,
classifica com AI (clef-flash) e notifica o time — resumo diário do resto.

```
Browser --POST /api/contact--> Worker (fetch) --> Fila --> Workflow: D1 -> clef -> email
                                  |                                              ^
                                  +---- assets ./dist (site) --------------------+
Cron 12:00 UTC --> Worker (scheduled) --> resumo diário --> E-mail
```

## Pré-requisitos

- Node.js 22+ e npm
- Conta Cloudflare com acesso ao Worker `impressione-me` (só para deploy)

## Começando

```sh
npm ci
npm run dev          # site em http://localhost:4321 (só páginas; /api/contact dá 404 aqui)
npm run dev:worker   # site + API em http://localhost:8787 (fluxo completo, tudo simulado)
npm test             # testes unitários (node:test, sem dependências)
npm run build        # build estático -> ./dist
```

O `dev:worker` usa bindings em modo `local` (fila e e-mail simulados — nada
sai de verdade). Exemplo:

```sh
curl -X POST -F "email=a@b.com" -F "website=" localhost:8787/api/contact
# -> 303 /contato/obrigado
```

## Estrutura

```
src/pages/           Páginas Astro (index, contato, contato/obrigado, contato/falha)
public/              Arquivos estáticos (+ .assetsignore do Worker)
workers/app/         Worker único: index.js (fetch + queue fino + scheduled),
                     contact-producer.js (form -> fila),
                     contact-consumer.js (dedupe -> workflow),
                     contact-classifier.js (clef-flash),
                     contact-workflow.js (D1 -> classifica -> roteia),
                     daily-summary.js (resumo), migrations/, wrangler.jsonc
tests/               Testes unitários + fixtures do golden set
dist/                Build (gerado, gitignored)
```

## Fluxo de contato

1. Form em `/contato` faz `POST /api/contact` (`email` obrigatório, campo
   oculto `website` como honeypot).
2. Worker valida e publica na fila `impressione-me-contact` (auto-provisionada
   no primeiro deploy) → `303 /contato/obrigado` (falha → `/contato/falha`;
   honeypot finge sucesso sem enfileirar).
3. Consumer salva no D1 (`INSERT OR IGNORE`) e dispara 1 `ContactWorkflow`.
4. Workflow classifica com clef-flash (`real_contact` | `marketing` |
   `bot_noise`; erro ou confiança < 0.6 → `unclassified`, sem e-mail).
5. `real_contact` → e-mail imediato. Demais → resumo diário (cron 12:00 UTC
   = 09h BRT) com contagens + top 20.

## Deploy

Automático via **Workers Builds** (1 projeto `impressione-me` ligado ao repo):

| Root directory | Build command | Deploy command |
|---|---|---|
| `/` (raiz) | `npm run build` | `npx wrangler deploy` |

Preview por PR ativo (`preview_urls: true`). Manual: `npm run deploy`.
O schema do D1 é garantido em runtime pelo próprio Worker (`db.js`, a partir
do mesmo DDL versionado em `workers/app/migrations/`) — dispensa `migrate`
no deploy. `npm run db:migrate` continua disponível para uso manual/preview.
Setup uma vez, fora do deploy:
1. Nada para o D1 de produção: o primeiro deploy auto-provisiona o banco
   `impressione-me-db` a partir do binding; o DDL entra pelo `db:migrate`
   do Build command acima.
2. Preview isolado é obrigatório (o `wrangler preview` não auto-provisiona):
   `wrangler d1 create impressione-contacts-preview` e
   `wrangler queues create impressione-me-contact-preview` → colar os ids
   no bloco `previews` do `wrangler.jsonc`; depois
   `wrangler d1 migrations apply impressione-contacts-preview --remote`.
   Sem isso o preview falha em `10021`. (Produção não precisa: o deploy
   cria o banco sozinho.)
3. Custom Domains `impressione.me` + `www` no Worker (Terraform, repo infra).
4. Checar plano do clef-flash: 1 chamada em preview; `403`/erro `5035`
   significa que exige Workers Paid ($5/mês).

## Relação com o repo de infra

DNS, domínios, R2 e OCI continuam em Terraform no repo `infrastructure`.
O app (fila, Worker, bindings) saiu do Terraform e é 100% Wrangler aqui —
ver `workers/README.md`.
