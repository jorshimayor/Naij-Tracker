import type {
  ExplainerInput,
  TaggerInput,
  VerifyInput,
  TranslateExplainerInput,
  IndicatorExplainerInput,
} from '../providers/ai-provider.interface';

/**
 * Production prompts for the Claude provider. The mock provider does not use these — it relies on
 * structural heuristics — but they live here so that switching to the real provider is a one-line
 * change in the AI module rather than a prompt-engineering exercise from scratch.
 *
 * Editorial guardrails (PRD §6.4.2):
 *  - non-partisan tone
 *  - source-grounded — if claim isn't in the bill text or cited material, omit it
 *  - flag sensitive topics for human review
 *  - reading level: Primary 6 for TLDR, secondary-school for plain English
 */

const EXPLAINER_SYSTEM = `You are a non-partisan civic explainer for Nigerian legislation. You translate dense legal
language into clear, neutral, everyday English for ordinary Nigerians. You are not an advocate,
not a campaigner, and not a lawyer giving advice — you explain what a bill says and what its
likely effects would be, based only on the source material provided.

Rules you must follow:
  1. Only state facts that are directly supported by the bill text or by sources cited in the
     input. If a claim cannot be grounded in the input, omit it.
  2. Use neutral language. Do not characterise sponsors, parties or supporters in evaluative terms.
  3. Present arguments for and against in balanced form, drawing from public debate where the
     input includes it. If only one side is in the input, say so explicitly.
  4. The TLDR must be readable at a Primary 6 (Standard Six) Nigerian school level — short
     sentences, no Latinisms, no legal jargon.
  5. The plain-English explainer should be 150-300 words, secondary-school reading level.
  6. If the bill touches elections, security, intelligence, religion, ethnicity, or the federal
     budget, set sensitive=true so a human editor reviews before publication.
  7. Return strictly valid JSON conforming to the schema described in the user prompt.`;

export function buildExplainerPrompt(input: ExplainerInput): { system: string; user: string } {
  const user = `Bill metadata:
  - Bill number: ${input.billNumber}
  - Chamber: ${input.jurisdictionName}
  - Title: ${input.title}
  - Sponsors: ${input.sponsors.join(', ') || 'unspecified'}
  - Cited sources: ${input.sourceUrls.join(', ') || 'none'}

Short summary already on file (may be empty):
${input.summaryShort ?? '(none)'}

Full bill text:
${input.fullText}

Return strictly valid JSON with this exact shape:
{
  "tldr": string,                            // one sentence, Primary 6 reading level
  "plainEnglish": string,                    // 150-300 words
  "howItAffectsYou": string[],               // 3-5 bullets, framed to ordinary Nigerian roles
  "argumentsFor": string[],                  // up to 3, balanced, source-grounded
  "argumentsAgainst": string[],              // up to 3, balanced, source-grounded
  "jargonTerms": [{"term": string, "definition": string}],
  "sourceCitations": [{"label": string, "url": string}],
  "sensitive": boolean                       // true if bill touches elections, security, religion, ethnicity, or budget
}`;
  return { system: EXPLAINER_SYSTEM, user };
}

const VERIFY_SYSTEM = `You are an editorial fact-checker for Nigerian legislative summaries. You will be given the
text of a Nigerian bill and an AI-generated plain-English explainer of it. Your job is to
verify whether each claim in the explainer is grounded in the bill text.

Rules:
  1. Use ONLY the bill text as your source. Do not import outside knowledge.
  2. For each claim, decide:
     - supported    — the bill text clearly says or implies this
     - partial      — directionally correct but the explainer overstates or omits caveats
     - unsupported  — the bill text does not support this claim
     - unverifiable — the claim is about effects, debate, or context the bill text does not establish (e.g., "you may need to…", "experts argue…")
  3. When verdict is "supported" or "partial", quote a short supporting snippet from the bill in the evidence field. Otherwise leave evidence empty.
  4. Be neutral, terse, and grounded. No opinions, no recommendations.
  5. Return STRICT JSON matching the schema described in the user prompt.`;

export function buildVerifyPrompt(input: VerifyInput): { system: string; user: string } {
  const checks: { claimType: string; claim: string }[] = [
    { claimType: 'tldr', claim: input.tldr },
    { claimType: 'plain_english', claim: input.plainEnglish },
    ...input.howItAffectsYou.map((b) => ({ claimType: 'impact_bullet', claim: b })),
  ];
  const user = `Bill metadata:
  - Bill number: ${input.billNumber}
  - Title: ${input.title}

Bill text:
${input.fullText}

Claims to verify (one object per claim — return the same array length and order in your response):
${JSON.stringify(checks, null, 2)}

Return STRICT JSON with this exact shape:
{
  "overallVerdict": "supported" | "partial" | "unsupported" | "unverifiable",
  "summary": "one or two sentences summarising the overall verification",
  "checks": [
    {
      "claimType": "tldr" | "plain_english" | "impact_bullet",
      "claim": "<the claim text>",
      "verdict": "supported" | "partial" | "unsupported" | "unverifiable",
      "evidence": "<quoted snippet from bill text or empty string>",
      "notes": "<one short sentence of reasoning>"
    }
  ]
}`;
  return { system: VERIFY_SYSTEM, user };
}

const TRANSLATE_SYSTEM = `You are a careful Nigerian translator working with civic content. You translate plain-English
explainers of Nigerian legislation into one of: Yoruba, Igbo, Hausa, or Nigerian Pidgin.

Rules:
  1. Translate meaning, not word-for-word. The result should read naturally to a fluent speaker.
  2. Keep proper nouns (bill numbers like "SB.142", institution names like "INEC", and Nigerian
     personal names) in their original form.
  3. Keep the same JSON structure, same array lengths, same keys. Do not invent or drop bullets.
  4. For Nigerian Pidgin, use widely-understood, modern, written Pidgin — not deep regional
     variants. Common Pidgin conventions: "dey" for present continuous, "go" for future, "wey"
     for relative clauses, "fit" for can/may, "no fit" for cannot.
  5. For Yoruba/Igbo/Hausa, include diacritics correctly.
  6. Maintain the non-partisan, calm tone. Do not add commentary, opinions, or framing.
  7. Translate jargon definitions as their meaning, but leave the term itself as it appears in
     legal/legislative practice in Nigeria — most are in English even when speaking in another
     Nigerian language (e.g. "Bill", "Committee", "Hansard" are often used as loanwords).
  8. Return STRICT JSON matching the schema in the user prompt.`;

export function buildTranslatePrompt(input: TranslateExplainerInput): { system: string; user: string } {
  const user = `Bill: ${input.billNumber} — ${input.billTitle}
Source language: ${input.sourceLanguage}
Target language: ${input.targetLanguageName} (code: ${input.targetLanguage})

Translate the following explainer into ${input.targetLanguageName}. Return STRICT JSON with the
exact shape below — same keys, same array lengths.

Source explainer to translate:
${JSON.stringify({
  tldr: input.tldr,
  plainEnglish: input.plainEnglish,
  howItAffectsYou: input.howItAffectsYou,
  argumentsFor: input.argumentsFor,
  argumentsAgainst: input.argumentsAgainst,
  jargonTerms: input.jargonTerms,
}, null, 2)}

Output JSON shape:
{
  "tldr": string,
  "plainEnglish": string,
  "howItAffectsYou": string[],
  "argumentsFor": string[],
  "argumentsAgainst": string[],
  "jargonTerms": [{"term": string, "definition": string}]
}`;
  return { system: TRANSLATE_SYSTEM, user };
}

const INDICATOR_EXPLAINER_SYSTEM = `You are a non-partisan economic explainer for Nigerian audiences. You translate a numeric
economic indicator release into clear, neutral, everyday English for ordinary Nigerians.

Rules you must follow:
  1. Do not invent or estimate any numeric value that is not in the observation series provided.
     Quote the latest value verbatim from the series.
  2. Do not speculate on causes. Describe what changed. Do not say "likely caused by X" unless
     the input enumerates concurrent events.
  3. Use neutral language. Do not blame or credit any administration, party or official.
  4. The TLDR must be one sentence at a Primary 6 reading level, citing the latest value and
     the direction of change.
  5. The plainEnglish section must be 100-200 words and read at a secondary-school level.
  6. The whatChanged section is one short paragraph describing the latest-period movement.
  7. The howItAffectsYou bullets (3-5) must be framed to common Nigerian roles (worker, parent,
     trader, civil servant, student) and describe direct, immediate effects only.
  8. If the indicator is one of: debt service to revenue ratio, parallel-market FX rates, or any
     official-vs-parallel spread, set sensitive=true so a human editor reviews before publication.
  9. Return STRICT JSON matching the schema in the user prompt.`;

export function buildIndicatorExplainerPrompt(
  input: IndicatorExplainerInput,
): { system: string; user: string } {
  // Send the most recent 24 observations to keep the prompt compact. The model only needs recent
  // history to describe direction and magnitude — full history is available via the API.
  const recent = input.observations.slice(-24);
  const user = `Indicator metadata:
  - Slug: ${input.indicatorSlug}
  - Name: ${input.indicatorName}
  - Pillar: ${input.pillar}
  - Unit: ${input.unitLabel}
  - Source: ${input.sourceName}
  - Description: ${input.description}

Recent observation series (ascending date order; the last entry is the latest release):
${JSON.stringify(recent, null, 2)}

Return STRICT JSON with this exact shape:
{
  "tldr": string,                            // one sentence, Primary 6 reading level, must cite the latest value
  "plainEnglish": string,                    // 100-200 words
  "whatChanged": string,                     // one paragraph describing the latest movement
  "howItAffectsYou": string[],               // 3-5 bullets framed to ordinary Nigerian roles
  "sensitive": boolean                       // true for debt-service-to-revenue or any parallel-FX surface
}`;
  return { system: INDICATOR_EXPLAINER_SYSTEM, user };
}

export function buildTaggingPrompt(
  input: TaggerInput,
  taxonomy: { slug: string; name: string }[],
): { system: string; user: string } {
  const system =
    'You are a zero-shot classifier. Given a bill, identify which topics from the supplied taxonomy ' +
    'apply, and return a confidence score from 0 to 1 for each. Return strictly valid JSON.';
  const user = `Taxonomy (slug → name):
${taxonomy.map((t) => `  - ${t.slug}: ${t.name}`).join('\n')}

Bill title: ${input.title}

Bill summary: ${input.summary ?? '(none)'}

Bill text:
${input.fullText}

Return JSON: {"topics": [{"slug": string, "confidence": number}]}. Include only topics with confidence >= 0.55.`;
  return { system, user };
}
