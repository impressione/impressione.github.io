import { WorkflowEntrypoint } from "cloudflare:workers";
import { classifyContact } from "./contact-classifier.js";
import { sendNewContactEmail } from "./contact-consumer.js";

// Pipeline durável de 1 contato. Steps são memoizados: replay nunca
// re-executa efeito já gravado (sem e-mail duplicado em retry).
export class ContactWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const { contactId } = event.payload;

    const load = () =>
      this.env.DB.prepare("SELECT * FROM contacts WHERE id = ?")
        .bind(contactId)
        .first();
    const contact = await step.do("load-contact", load);
    if (!contact) {
      return { skipped: "contact-not-found" };
    }

    const cls = await step.do(
      "classify",
      {
        retries: { limit: 3, delay: "10 seconds", backoff: "exponential" },
        timeout: "2 minutes",
      },
      () => classifyContact(this.env.AI, contact),
    );

    await step.do("record-classification", () =>
      this.env.DB.prepare(
        `UPDATE contacts SET classification = ?, confidence = ?, reason = ?,
         classified_at = ? WHERE id = ?`,
      )
        .bind(cls.type, cls.confidence, cls.reason, new Date().toISOString(), contactId)
        .run(),
    );

    if (cls.type === "real_contact") {
      await step.do("notify", () => sendNewContactEmail(this.env, contact));
      await step.do("mark-emailed", () =>
        this.env.DB.prepare(
          "UPDATE contacts SET emailed_at = ? WHERE id = ?",
        )
          .bind(new Date().toISOString(), contactId)
          .run(),
      );
      return { emailed: true, type: cls.type };
    }

    // Fail-closed com saída: dorme até 20h aguardando aprovação manual.
    // Sem aprovação, o timeout cai no resumo diário (v1: sem endpoint ainda).
    try {
      await step.waitForEvent("review-approved", { timeout: "20 hours" });
      await step.do("notify-late", () =>
        sendNewContactEmail(
          this.env,
          contact,
          `Contato aprovado (revisão): ${contact.email}`,
        ),
      );
      return { emailed: true, type: cls.type, via: "manual-review" };
    } catch {
      return { emailed: false, type: cls.type, via: "daily-summary" };
    }
  }
}
