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
  if (submission.website) {
    return "bot";
  }

  if (!submission.email) {
    return "O e-mail e obrigatorio.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(submission.email)) {
    return "Informe um e-mail valido.";
  }

  return null;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
    },
  });
}

export async function onRequestPost(context) {
  console.log("Received contact form submission");
  const contentType = context.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
    return context.redirect("/contato/falha", 303);
  }

  console.log("Parsing form data");
  const formData = await context.request.formData();

  const submission = readSubmission(formData);
  console.log("Submission data:", submission);
  const validationError = validateSubmission(submission);
  console.log("Validation result:", validationError || "valid");
  if (validationError === "bot") {
    return context.redirect("/contato/obrigado", 303);
  }

  if (validationError) {
    return context.redirect("/contato/falha", 303);
  }
  console.log("Sending submission to queue");
  await context.env.CONTACT_QUEUE.send({
    email: submission.email,
    name: submission.name,
    company: submission.company,
    interest: submission.interest,
    message: submission.message,
    submittedAt: submission.submittedAt,
    source: "website-contact-form",
  });
  console.log("Submission sent to queue successfully");
  return context.redirect("/contato/obrigado", 303);
}
