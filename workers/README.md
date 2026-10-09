# Worker

Um Worker só: serve o site estático, recebe o form de contato e consome a
fila (`fetch` + `queue` no mesmo entrypoint). Deploy único: `npm run deploy`.

```
workers/
  app/
    index.js       fetch (/api/contact -> fila, resto -> ASSETS) + queue (fila -> email)
    wrangler.jsonc
```

## Convenção

- Pasta `workers/` (plural) como contêiner para o caso de um segundo Worker
  aparecer (ex. cron isolado) — cada um com nome singular e `wrangler.jsonc`
  próprio. Hoje só existe `app`.
- Código compartilhado (schema da mensagem da fila, validação) vai para
  `workers/shared/` quando o segundo uso aparecer — não antes.
- Recursos compartilhados (fila `impressione-me-contact`, futura tabela D1)
  são criados uma vez via CLI (`npm run queue:create`, etc.) e referenciados
  pelos bindings.

## Deploy (Workers Builds)

Um único projeto conectado ao repo Git:

| Projeto | Root directory | Build command | Deploy command | Watch paths |
|---|---|---|---|---|
| `impressione-me` | `/` (raiz) | `npm run build` | `npx wrangler deploy -c workers/app/wrangler.jsonc` | `src/**`, `public/**`, `workers/**`, `astro.config.mjs`, `package.json` |

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
