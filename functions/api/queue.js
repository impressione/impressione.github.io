export async function onRequest(context) {
  await context.env.CONTACT_QUEUE.send({
    email: "gwoliveira@gmail.com",
    name: "Guilherme Oliveira",
    company: "Impressione",
    interest: "Testing Cloudflare Queues",
    message: "This is a test message.",
    submittedAt: new Date().toISOString(),
    source: "website-contact-form",
  });

  return new Response("Sent!");
}