# Worker

Um Worker só: serve o site estático, recebe o form de contato e consome a
fila (`fetch` + `queue` no mesmo entrypoint). Deploy único: `npm run deploy`.

```
wrangler.jsonc      config do Worker (raiz: o Wrangler e o Builds acham sozinhos)
workers/
  app/
    index.js             entrypoint (fetch + queue fino + scheduled)
    contact-producer.js  form -> fila
    contact-consumer.js  dedupe D1 -> workflow.create (+ helpers de email)
    contact-classifier.js  clef-flash (fail-closed)
    contact-workflow.js  ContactWorkflow (classifica -> roteia)
    daily-summary.js     query + monta resumo diário
    migrations/          DDL do D1
```

## Convenção

- Config `wrangler.jsonc` na raiz (1 Worker = 1 config). Se um segundo Worker
  aparecer (ex. cron isolado), cada um ganha pasta própria com seu
  `wrangler.jsonc` e o deploy passa a usar `-c`.
- Código compartilhado (schema da mensagem da fila, validação) vai para
  `workers/shared/` quando o segundo uso aparecer — não antes.
- Recursos compartilhados: fila auto-provisionada pelo Wrangler no primeiro
  deploy; D1 idem (`impressione-me-db`, DDL em `migrations/` aplicado pelo
  Build command); DNS segue Terraform.

## Deploy (Workers Builds)

Um único projeto conectado ao repo Git:

| Projeto | Root directory | Build command | Deploy command | Watch paths |
|---|---|---|---|---|
| `impressione-me` | `/` (raiz) | `npm run build` | `npx wrangler deploy` | `src/**`, `public/**`, `workers/**`, `wrangler.jsonc`, `astro.config.mjs`, `package.json` |

Preview por PR ativo (`preview_urls: true`). Deploy manual local: `npm run deploy`.

## Testes locais

- `npm test` — unitários (`node:test`, sem dependências): `fetch`
  (validação/redirects/honeypot) e `queue` (email/replyTo/descarte).
- `npm run dev:worker` — sobe o Worker com assets + API em
  `http://localhost:8787` (bindings em modo `local`: fila e email simulados,
  nada sai de verdade). Ex.:
  `curl -X POST -F "email=a@b.com" -F "website=" localhost:8787/api/contact`
  → `303 /contato/obrigado`.
- `npm run dev` (Astro) serve só as páginas — `/api/contact` dá 404 nele
  porque a API mora no Worker, não no Astro.

## Evolução prevista do fluxo de contato

1. `fetch POST /api/contact`: valida o form e publica na fila (produtor).
2. `queue`: salva o contato no D1, classifica com Workers AI
   (tipo/interesse), atualiza o registro e envia o e-mail ao time com a
   classificação.
