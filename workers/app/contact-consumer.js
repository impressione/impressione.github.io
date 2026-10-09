import { ensureSchema } from "./db.js";

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildEmailBody(fields) {
  const lines = [
    "Novo contato pelo formulario de impressione.me",
    "",
    `Email: ${fields.email}`,
    `Nome: ${fields.name || "-"}`,
    `Empresa: ${fields.company || "-"}`,
    `Interesse: ${fields.interest || "-"}`,
    `Enviado em: ${fields.submittedAt || "-"}`,
    `Origem: ${fields.source || "-"}`,
    "",
    "Mensagem:",
    fields.message || "-",
  ];

  return lines.join("\n");
}

export function sanitizeSubmission(body) {
  return {
    email: normalize(body?.email),
    name: normalize(body?.name),
    company: normalize(body?.company),
    interest: normalize(body?.interest),
    message: normalize(body?.message),
    submittedAt: normalize(body?.submittedAt),
    source: normalize(body?.source),
  };
}

export async function sendNewContactEmail(env, contact, subject) {
  await env.EMAIL.send({
    from: env.FROM_EMAIL,
    to: env.TEAM_EMAIL,
    subject: subject ?? `Novo contato de ${contact.email}`,
    text: buildEmailBody(contact),
    replyTo: contact.email,
  });
}

// Consumer fino: dedupe + dispara 1 instância do workflow por contato.
// O processamento durável (classificar → rotear) mora no ContactWorkflow.
export async function handleQueue(batch, env) {
  await ensureSchema(env.DB);

  for (const message of batch.messages) {
    const submission = sanitizeSubmission(message.body);

    if (!submission.email) {
      continue;
    }

    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO contacts
       (email, name, company, interest, message, submittedAt, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        submission.email,
        submission.name,
        submission.company,
        submission.interest,
        submission.message,
        submission.submittedAt,
        submission.source || "website-contact-form",
      )
      .run();

    if (inserted.meta.changes === 0) {
      console.log("Duplicate delivery, skipping workflow");
      continue;
    }

    const contactId = inserted.meta.last_row_id;
    if (!Number.isInteger(contactId)) {
      console.log("Insert without row id, skipping workflow");
      continue;
    }
    await env.CONTACT_WORKFLOW.create({
      id: `contact-${contactId}`,
      params: { contactId },
    });
    console.log(`Workflow started for contact ${contactId}`);
  }
}
