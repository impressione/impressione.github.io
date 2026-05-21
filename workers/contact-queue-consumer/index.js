function buildEmailBody(fields) {
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

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSubmission(body) {
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

export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      const submission = sanitizeSubmission(message.body);

      if (!submission.email) {
        continue;
      }

      await env.EMAIL.send({
        from: env.FROM_EMAIL,
        to: env.TEAM_EMAIL,
        subject: `Novo contato de ${submission.email}`,
        text: buildEmailBody(submission),
        replyTo: submission.email,
      });
    }
  },
};
