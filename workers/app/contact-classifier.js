// Classificação de contatos via clef-flash (modelo de decisão da Cloudflare).
// Fail-closed: qualquer erro ou baixa confiança resulta em "unclassified"
// (sem e-mail imediato, aparece no resumo diário).

export const CLASSIFIER_MODEL = "@cf/cloudflare/clef-flash";
export const CLASSIFIER_MODEL_ID = "clef-flash";
export const CONFIDENCE_THRESHOLD = 0.6;

export const CONTACT_TYPES = [
  "real_contact",
  "marketing",
  "phishing_scam",
  "spam",
  "suspicious_language",
];

// `spam` tem prioridade menor que `phishing_scam`: vencendo por pouco,
// com phishing próximo, escala para phishing (golpe é o erro mais caro).
export const PHISHING_ESCALATION_MARGIN = 0.15;

function breakdown(probs) {
  return CONTACT_TYPES.map((t) => `${t} ${Number(probs[t] ?? 0).toFixed(2)}`).join(" / ");
}

// Normaliza a resposta `choice` do clef para { option, probability }.
// Formatos tolerados (o schema exato varia por versão do modelo).
function bestOption(answer) {
  if (!answer || typeof answer !== "object") return null;

  if (answer.probabilities && typeof answer.probabilities === "object") {
    let best = null;
    for (const type of CONTACT_TYPES) {
      const prob = Number(answer.probabilities[type] ?? NaN);
      if (Number.isFinite(prob) && (!best || prob > best.probability)) {
        best = { option: type, probability: prob };
      }
    }
    return best;
  }

  if (typeof answer.answer === "string" && CONTACT_TYPES.includes(answer.answer)) {
    const prob = Number(answer.confidence ?? answer.probability ?? NaN);
    return { option: answer.answer, probability: prob };
  }

  if (typeof answer.choice === "string" && CONTACT_TYPES.includes(answer.choice)) {
    const prob = Number(answer.confidence ?? answer.probability ?? NaN);
    return { option: answer.choice, probability: prob };
  }

  return null;
}

export async function classifyContact(ai, submission) {
  try {
    const response = await ai.run(CLASSIFIER_MODEL, {
      model: CLASSIFIER_MODEL_ID,
      state: {
        name: submission.name,
        company: submission.company,
        interest: submission.interest,
        message: submission.message,
      },
      questions: {
        tipo: {
          type: "choice",
          instructions:
            "Classifique a mensagem do formulário de contato de uma consultoria de software brasileira. O site opera em português e inglês.",
          criteria: {
            real_contact: "Pedido legítimo de projeto, orçamento ou conversa sobre software, em português ou inglês",
            marketing: "Oferta de serviços ao site (SEO, tráfego, listas, parcerias comerciais)",
            phishing_scam: "Tentativa de golpe: urgência falsa, conta bloqueada, prêmio, pedido de dados/senha/pagamento, links suspeitos. Em dúvida entre spam e phishing, prefira phishing_scam",
            spam: "Lixo genérico sem tentativa clara de golpe: testes, gibberish, link dumps. Prioridade menor que phishing_scam",
            suspicious_language: "Mensagem em qualquer idioma que não seja português ou inglês, mesmo que pareça legítima",
          },
        },
      },
    });

    const best = bestOption(response?.answers?.tipo);
    if (!best || !Number.isFinite(best.probability)) {
      return { type: "unclassified", confidence: 0, reason: "clef-answer-unparseable" };
    }
    const probs = response.answers.tipo.probabilities ?? {};
    // O clef não justifica em texto — o "motivo" é o placar completo.
    let { option, probability } = best;
    let reason = breakdown(probs);
    const phishingProb = Number(probs.phishing_scam ?? NaN);
    if (
      option === "spam" &&
      Number.isFinite(phishingProb) &&
      phishingProb >= probability - PHISHING_ESCALATION_MARGIN
    ) {
      option = "phishing_scam";
      probability = phishingProb;
      reason += " (preempção: phishing > spam)";
    }
    if (probability < CONFIDENCE_THRESHOLD) {
      return { type: "unclassified", confidence: probability, reason: `low-confidence: ${reason}` };
    }
    return { type: option, confidence: probability, reason };
  } catch (err) {
    return {
      type: "unclassified",
      confidence: 0,
      reason: `ai-error: ${err?.message || String(err)}`,
    };
  }
}
