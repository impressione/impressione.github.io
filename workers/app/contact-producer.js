function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readSubmission(formData) {
  return {
    email: normalize(formData.get("email")),
    name: normalize(formData.get("name")),
    company: normalize(formData.get("company")),
    interest: normalize(formData.get("interest")),
    message: normalize(formData.get("message")),
    website: normalize(formData.get("website")),
    submittedAt: new Date().toISOString(),
  };
}

function validateSubmission(submission) {
  if (!submission.email) {
    return "O e-mail é obrigatório.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(submission.email)) {
    return "Informe um e-mail válido.";
  }

  return null;
}

function redirect(path) {
  return new Response(null, {
    status: 303,
    headers: { Location: path },
  });
}

export async function handleContact(request, env) {
  console.log("Received contact form submission");
  const contentType = request.headers.get("content-type") || "";
  if (
    !contentType.includes("multipart/form-data") &&
    !contentType.includes("application/x-www-form-urlencoded")
  ) {
    return redirect("/contato/falha");
  }

  console.log("Parsing form data");
  const formData = await request.formData();
  const submission = readSubmission(formData);

  // Honeypot anti-spam: bots preenchem o campo oculto `website`.
  // Finge sucesso sem enfileirar para não sinalizar a armadilha.
  if (submission.website) {
    console.log("Honeypot filled, dropping submission silently");
    return redirect("/contato/obrigado");
  }

  const validationError = validateSubmission(submission);
  console.log("Validation result:", validationError || "valid");

  if (validationError) {
    return redirect("/contato/falha");
  }

  console.log("Sending submission to queue");
  await env.CONTACT_QUEUE.send({
    email: submission.email,
    name: submission.name,
    company: submission.company,
    interest: submission.interest,
    message: submission.message,
    submittedAt: submission.submittedAt,
    source: "website-contact-form",
  });
  console.log("Submission sent to queue successfully");
  return redirect("/contato/obrigado");
}
