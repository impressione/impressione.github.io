import { handleContact } from "./contact-producer.js";
import { handleQueue } from "./contact-consumer.js";

export default {
  async queue(batch, env) {
    await handleQueue(batch, env);
  },
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: { Allow: "POST, OPTIONS" },
        });
      }
      if (request.method === "POST") {
        return handleContact(request, env);
      }
      return new Response("Method Not Allowed", { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};
