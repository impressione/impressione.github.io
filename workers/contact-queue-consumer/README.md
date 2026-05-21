# Contact Queue Consumer

This Worker is the queue consumer for website contact submissions.

## Expected bindings

- `EMAIL`: Cloudflare Email Service send binding
- `FROM_EMAIL`: verified sender address
- `TEAM_EMAIL`: inbox that should receive new contact notifications

## Expected queue payload

The Pages Function at `functions/api/contact.js` publishes messages shaped like:

```json
{
  "email": "someone@example.com",
  "name": "Someone",
  "company": "Example Inc.",
  "interest": "Novo produto ou sistema",
  "message": "Vamos conversar.",
  "submittedAt": "2026-05-21T12:00:00.000Z",
  "source": "website-contact-form"
}
```
