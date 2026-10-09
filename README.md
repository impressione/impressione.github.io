# impressione.me

Site institucional da Impressione (`https://impressione.me`): Astro estático
servido por um Cloudflare Worker, com formulário de contato que enfileira
mensagens e notifica o time por e-mail.

```
Browser --POST /api/contact--> Worker (fetch) --> Fila --> Worker (queue) --> E-mail
                                  |                                    ^
                                  +---- assets ./dist (site) -----------+
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
workers/app/         Worker único: index.js (entrypoint fetch + queue),
                     contact-producer.js (form -> fila),
                     contact-consumer.js (fila -> e-mail), wrangler.jsonc
tests/               Testes unitários do Worker
dist/                Build (gerado, gitignored)
```

## Fluxo de contato

1. Form em `/contato` faz `POST /api/contact` (`email` obrigatório, campo
   oculto `website` como honeypot).
2. Worker valida e publica `{email, name, company, interest, message,
   submittedAt}` na fila `impressione-me-contact` → `303 /contato/obrigado`
   (falha de validação → `303 /contato/falha`; honeypot preenchido finge
   sucesso sem enfileirar).
3. Consumer da mesma fila monta o e-mail (`from/to = contato@impressione.me`,
   `replyTo` = visitante) e envia via binding `send_email`.

## Deploy

Automático via **Workers Builds** (1 projeto `impressione-me` ligado ao repo):

| Root directory | Build command | Deploy command |
|---|---|---|
| `/` (raiz) | `npm run build` | `npx wrangler deploy` |

Preview por PR ativo (`preview_urls: true`). Manual: `npm run deploy`.
Recursos criados uma vez, fora do deploy: fila `impressione-me-contact`
(Terraform no repo `infrastructure`, módulo `cloudflare-workers`) e os
Custom Domains `impressione.me` + `www` no Worker.

## Relação com o repo de infra

DNS, domínios, R2 e OCI continuam em Terraform no repo `infrastructure`.
O app (fila, Worker, bindings) saiu do Terraform e é 100% Wrangler aqui —
ver `workers/README.md`.
