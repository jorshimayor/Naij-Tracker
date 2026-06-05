import { Injectable } from '@nestjs/common';
import type {
  AIProvider,
  ExplainerInput,
  ExplainerOutput,
  TaggerInput,
  TaggerOutput,
  VerifyInput,
  VerifyOutput,
  TranslateExplainerInput,
  TranslateExplainerOutput,
  IndicatorExplainerInput,
  IndicatorExplainerOutput,
} from './ai-provider.interface';

// Narrow set — only flag bills that touch the categories that civil society + press
// reliably consider politically charged. "appropriations" was previously here but it
// appears in nearly every bill's funding section, so it caused too many false positives.
const SENSITIVE_KEYWORDS = [
  'electoral act', 'inec', 'bvas', 'electronic transmission',
  'lawful interception', 'intelligence agency', 'surveillance', 'national security agencies',
  'sharia', 'religion',
  'ethnic group', 'tribal',
];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'education': ['school', 'student', 'university', 'curriculum', 'education', 'teacher', 'tertiary'],
  'health': ['health', 'hospital', 'medical', 'antenatal', 'doctor', 'nurse', 'disease', 'immunization', 'maternal'],
  'security': ['security', 'intelligence', 'interception', 'surveillance', 'defence', 'police', 'armed forces', 'terrorism'],
  'energy': ['power', 'electricity', 'energy', 'tariff', 'grid', 'transmission', 'solar', 'gas'],
  'tax-revenue': ['tax', 'revenue', 'levy', 'duty', 'firs', 'vat', 'income tax'],
  'gender': ['gender', 'women', 'pregnant', 'maternity', 'paternity', 'paternal', 'maternal', 'gbv', 'domestic violence'],
  'anti-corruption': ['corruption', 'efcc', 'icpc', 'fraud', 'embezzlement', 'bribery'],
  'technology': ['technology', 'startup', 'digital', 'cyber', 'internet', 'tech', 'software', 'data protection', 'innovation'],
  'agriculture': ['agriculture', 'farm', 'farmer', 'crop', 'livestock', 'food security'],
  'transport': ['transport', 'road', 'railway', 'aviation', 'port', 'highway', 'traffic'],
  'judiciary': ['judiciary', 'court', 'judge', 'legal', 'tribunal', 'magistrate'],
  'labour': ['labour', 'worker', 'employment', 'wages', 'union', 'public service', 'public servant', 'civil service'],
  'elections': ['election', 'inec', 'voting', 'polling', 'electoral act', 'ballot', 'bvas'],
  'environment': ['climate', 'environment', 'pollution', 'flood', 'desertification', 'carbon', 'erosion', 'emissions'],
  'youth': ['youth', 'children', 'minor', 'under-18', 'adolescent', 'sport'],
  'trade': ['trade', 'industry', 'manufacturing', 'export', 'import', 'tariff', 'commerce'],
  'housing': ['housing', 'mortgage', 'rent', 'tenancy', 'urban', 'real estate'],
  'human-rights': ['human rights', 'discrimination', 'disability', 'freedom', 'speech', 'expression', 'fundamental rights'],
  'media': ['media', 'press', 'journalism', 'broadcast', 'free speech', 'censorship'],
  'finance': ['bank', 'finance', 'capital', 'investment', 'monetary', 'cbn', 'currency', 'naira'],
};

function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function lowercaseHaystack(input: { title: string; fullText: string; summary?: string }) {
  return [input.title, input.summary ?? '', input.fullText].join(' ').toLowerCase();
}

/**
 * Deterministic mock that mimics what a real Claude provider would return.
 *
 * The output uses structural heuristics rather than real summarization, but the *shape* and the
 * downstream pipeline (storage, review flagging, citation tracking) is identical to the production
 * path. Swap to ClaudeProvider once an ANTHROPIC_API_KEY is configured.
 */
@Injectable()
export class MockClaudeProvider implements AIProvider {
  async generateExplainer(input: ExplainerInput): Promise<ExplainerOutput> {
    const haystack = lowercaseHaystack({ title: input.title, fullText: input.fullText, summary: input.summaryShort });
    const sensitive = SENSITIVE_KEYWORDS.some((kw) => haystack.includes(kw));

    const sponsorPhrase =
      input.sponsors.length === 0
        ? 'a member of the chamber'
        : input.sponsors.length === 1
          ? input.sponsors[0]
          : `${input.sponsors.slice(0, -1).join(', ')} and ${input.sponsors.at(-1)}`;

    const firstSentence = input.fullText.split(/(?<=\.)\s+/)[0]?.slice(0, 280) ?? input.title;
    const wordList = input.fullText.toLowerCase().match(/[a-z]+/g) ?? [];
    const length = wordList.length;

    const tldr =
      `Bill ${input.billNumber} in the ${input.jurisdictionName}, sponsored by ${sponsorPhrase}, ` +
      `proposes to ${this.lowercaseFirst(input.title.replace(/^A Bill for an Act to\s*/i, '').replace(/,?\s*and for Related Matters\.?$/i, ''))}.`;

    const plainEnglish = [
      `${tldr}`,
      ``,
      `In plain English: ${firstSentence}`,
      ``,
      `If passed, the bill would change how the relevant institutions are required to act, ` +
        `creating new obligations and rights that take effect after the President's assent. ` +
        `It runs roughly ${length} words of legal text, and the operative provisions are concentrated ` +
        `in the sections setting out who is covered, who pays, and who enforces. The bill was ` +
        `introduced on the floor of the chamber and has since moved through the legislative stages ` +
        `recorded in the timeline. The plain-English summary here is generated automatically and ` +
        `should be read alongside the original text, which is linked below.`,
    ].join('\n');

    const howItAffectsYou = this.buildImpactBullets(haystack, input.title);
    const { argumentsFor, argumentsAgainst } = this.buildArguments(haystack);
    const jargonTerms = this.buildJargon(haystack);
    const sourceCitations = input.sourceUrls.map((url, i) => ({
      label: i === 0 ? 'Official bill text' : `Source ${i + 1}`,
      url,
    }));

    return {
      tldr,
      plainEnglish,
      howItAffectsYou,
      argumentsFor,
      argumentsAgainst,
      jargonTerms,
      sourceCitations,
      sensitive,
      modelUsed: 'mock-claude-v0',
    };
  }

  async translateExplainer(input: TranslateExplainerInput): Promise<TranslateExplainerOutput> {
    const tag = `[${input.targetLanguage}]`;
    return {
      tldr: `${tag} ${input.tldr}`,
      plainEnglish: `${tag} ${input.plainEnglish}`,
      howItAffectsYou: input.howItAffectsYou.map((s) => `${tag} ${s}`),
      argumentsFor: input.argumentsFor.map((s) => `${tag} ${s}`),
      argumentsAgainst: input.argumentsAgainst.map((s) => `${tag} ${s}`),
      jargonTerms: input.jargonTerms.map((j) => ({ term: j.term, definition: `${tag} ${j.definition}` })),
      modelUsed: 'mock-claude-v0',
    };
  }

  async verifyExplainer(input: VerifyInput): Promise<VerifyOutput> {
    const checks = [
      { claimType: 'tldr' as const, claim: input.tldr },
      { claimType: 'plain_english' as const, claim: input.plainEnglish },
      ...input.howItAffectsYou.map((c) => ({ claimType: 'impact_bullet' as const, claim: c })),
    ].map((c) => ({
      ...c,
      verdict: 'unverifiable' as const,
      evidence: '',
      notes: 'Mock provider cannot verify against bill text. Switch AI_PROVIDER to groq/deepseek/gemini for real verification.',
    }));
    return {
      overallVerdict: 'unverifiable',
      summary: 'Mock provider — no real verification performed.',
      checks,
      modelUsed: 'mock-claude-v0',
    };
  }

  async classifyTopics(
    input: TaggerInput,
    taxonomy: { slug: string; name: string }[],
  ): Promise<TaggerOutput> {
    const haystack = lowercaseHaystack(input);
    const scored: { slug: string; confidence: number }[] = [];
    for (const topic of taxonomy) {
      const keywords = TOPIC_KEYWORDS[topic.slug] ?? [];
      const hits = keywords.filter((kw) => haystack.includes(kw)).length;
      if (hits > 0) {
        const confidence = Math.min(0.55 + hits * 0.12, 0.98);
        scored.push({ slug: topic.slug, confidence });
      }
    }
    scored.sort((a, b) => b.confidence - a.confidence);
    return { topics: scored.slice(0, 4) };
  }

  async explainIndicator(input: IndicatorExplainerInput): Promise<IndicatorExplainerOutput> {
    const obs = [...input.observations].sort((a, b) => a.date.localeCompare(b.date));
    if (obs.length === 0) {
      return {
        tldr: `${input.indicatorName} has no observations yet.`,
        plainEnglish: `No data has been ingested for this indicator. Once ${input.sourceName} publishes the next release, an explainer will be generated automatically.`,
        whatChanged: 'No change to report — no observations on file.',
        howItAffectsYou: ['Check back after the next official release.'],
        sensitive: false,
        modelUsed: 'mock-claude-v0',
      };
    }
    const latest = obs[obs.length - 1];
    const previous = obs.length > 1 ? obs[obs.length - 2] : null;
    const yearAgo = obs.length >= 13 ? obs[obs.length - 13] : null;

    const formatValue = (v: number) =>
      Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2);
    const formatDate = (d: string) => {
      const date = new Date(d);
      return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    };
    const diff = previous ? latest.value - previous.value : 0;
    const direction = diff > 0 ? 'rose' : diff < 0 ? 'fell' : 'held';
    const directionWord = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';

    // Sensitive indicators: anything tagged debt-service-to-revenue or any FX parallel market
    // surface is gated on editorial review (PRD §6.4.3). Mock provider mirrors that policy.
    const sensitive =
      input.indicatorSlug === 'debt-service-to-revenue' ||
      input.indicatorSlug.includes('parallel');

    const tldr =
      `${input.indicatorName} stands at ${formatValue(latest.value)}${input.unitLabel} ` +
      `as of ${formatDate(latest.date)}` +
      (previous
        ? `, ${direction} ${formatValue(Math.abs(diff))}${input.unitLabel} from ${formatValue(previous.value)}${input.unitLabel} the prior period.`
        : '.');

    const yearAgoLine = yearAgo
      ? ` Twelve months ago it was ${formatValue(yearAgo.value)}${input.unitLabel}.`
      : '';

    const plainEnglish = [
      `${input.indicatorName} is ${input.description}`,
      ``,
      `As of ${formatDate(latest.date)}, the value is ${formatValue(latest.value)}${input.unitLabel}.` +
        yearAgoLine +
        ` This indicator is published by ${input.sourceName} and is currently ${directionWord} relative to the previous reading.`,
      ``,
      `The plain-English summary on this page is generated automatically from the observation series. ` +
        `It is meant to convey direction and order of magnitude, not to substitute for ${input.sourceName}'s ` +
        `own narrative release notes, which should be read alongside it.`,
    ].join('\n');

    const whatChanged = previous
      ? `Between ${formatDate(previous.date)} and ${formatDate(latest.date)}, ${input.indicatorName} ` +
        `${direction} from ${formatValue(previous.value)}${input.unitLabel} to ${formatValue(latest.value)}${input.unitLabel} — ` +
        `a change of ${diff >= 0 ? '+' : ''}${formatValue(diff)}${input.unitLabel}.`
      : `First observation on record: ${formatValue(latest.value)}${input.unitLabel} for ${formatDate(latest.date)}.`;

    const howItAffectsYou = this.buildIndicatorImpactBullets(input.indicatorSlug, latest.value, directionWord);

    return { tldr, plainEnglish, whatChanged, howItAffectsYou, sensitive, modelUsed: 'mock-claude-v0' };
  }

  private buildIndicatorImpactBullets(slug: string, value: number, direction: string): string[] {
    const bullets: string[] = [];
    if (slug.includes('cpi') || slug.includes('inflation')) {
      bullets.push(
        direction === 'down'
          ? 'If you buy food or transport, the headline rate of price increases is easing — though prices are still rising in absolute terms.'
          : 'If you buy food or transport, the rate at which prices are climbing has not slowed, and household budgets remain under pressure.',
      );
      bullets.push('If you are paid a salary, your real (inflation-adjusted) take-home is squeezed until wages catch up.');
      bullets.push('If you save Naira, the real value of cash savings is being eroded at roughly this rate per year.');
    } else if (slug.includes('mpr')) {
      bullets.push(
        direction === 'down'
          ? 'If you have a loan, banks may pass through some of the rate cut, modestly reducing borrowing costs.'
          : 'If you have a loan or planned to borrow, expect lending rates to track upwards in coming weeks.',
      );
      bullets.push('If you hold government bonds, yields tend to move with the policy rate.');
    } else if (slug.includes('usd-ngn') || slug.includes('fx') || slug.includes('nafem')) {
      bullets.push('If you import goods, your Naira cost of inputs is set by this rate (plus a market premium).');
      bullets.push('If you receive remittances in USD, the Naira value of each dollar received tracks this rate.');
      bullets.push('If you travel abroad, your effective spending power in Naira terms moves with this number.');
    } else if (slug.includes('reserves')) {
      bullets.push('If reserves rise, the CBN has more room to defend the Naira and meet import demand.');
      bullets.push('If reserves fall, expect tighter FX availability and pressure on the exchange rate.');
    } else if (slug.includes('debt-service')) {
      bullets.push('If debt service consumes a larger share of revenue, less is left for capital projects (roads, schools, hospitals).');
      bullets.push('If you work in or rely on a federally-funded service, this is the single number most likely to determine its funding next year.');
    } else if (slug.includes('debt')) {
      bullets.push('If debt rises faster than GDP, future taxes or subsidy cuts are more likely to follow.');
    } else if (slug.includes('gdp')) {
      bullets.push('If GDP grows, more jobs and business opportunities tend to follow — though the gain is unevenly distributed.');
      bullets.push('If GDP contracts, expect hiring freezes and tighter business credit.');
    } else if (slug.includes('oil')) {
      bullets.push('If you live in an oil-producing state, derivation receipts move with this number.');
      bullets.push('If you fill up at the pump, retail PMS price is downstream of production volume and global crude price.');
    } else if (slug.includes('ngx') || slug.includes('asi')) {
      bullets.push('If you hold pension assets, a significant share is invested in NGX-listed equities.');
      bullets.push('If you trade stocks, this is the broad market benchmark your portfolio is measured against.');
    } else if (slug.includes('faac')) {
      bullets.push('If you live in a state with low IGR, this monthly federal allocation is most of your state government\'s budget.');
      bullets.push('If FAAC rises, expect more state-level spending; if it falls, expect delays in salaries and capital projects.');
    } else if (slug.includes('unemployment')) {
      bullets.push('If you are job-seeking, this is the broad measure of how many other people are in the same position.');
    }
    if (bullets.length === 0) {
      bullets.push(`The current reading is ${value}; watch the next release for confirmation of the direction.`);
    }
    return bullets.slice(0, 5);
  }

  private lowercaseFirst(s: string): string {
    return s.length === 0 ? s : s[0].toLowerCase() + s.slice(1);
  }

  private buildImpactBullets(haystack: string, title: string): string[] {
    const bullets: string[] = [];
    if (/(paternity|maternity|child|pregnant|family)/.test(haystack)) {
      bullets.push('If you are a parent or expectant parent, you may gain new statutory leave or healthcare entitlements.');
    }
    if (/(tax|levy|duty|vat)/.test(haystack)) {
      bullets.push('If you work in the affected sector, expect a change in your tax obligations or compliance reporting.');
    }
    if (/(election|inec|polling|bvas|voting)/.test(haystack)) {
      bullets.push('If you vote, the rules governing how your polling unit result is recorded and transmitted may change.');
    }
    if (/(disability|disabilities|accessibility)/.test(haystack)) {
      bullets.push('If you live with a disability, this creates an agency you can petition when a public service violates your rights.');
    }
    if (/(climate|flood|erosion|environment)/.test(haystack)) {
      bullets.push('If you live in a coastal or flood-prone state, this bill earmarks federal money for adaptation projects in your area.');
    }
    if (/(security|intelligence|interception|surveillance)/.test(haystack)) {
      bullets.push('If you use mobile or internet services, the legal basis under which your communications may be intercepted will change.');
    }
    if (/(startup|tech|digital|cyber|innovation)/.test(haystack)) {
      bullets.push('If you work in or run a Nigerian tech startup, you may become eligible for new federally-backed financing.');
    }
    if (/(health|hospital|antenatal|maternal|under-five)/.test(haystack)) {
      bullets.push('If you are pregnant or care for young children, certain primary healthcare services may become free at the point of use.');
    }
    if (/(speech|expression|journalism|press|cyberstalking)/.test(haystack)) {
      bullets.push('If you publish or comment online, the threshold for what counts as a criminal offence is being narrowed.');
    }
    if (bullets.length === 0) {
      bullets.push(`The bill alters the legal framework signalled in its title: "${title}". Watch the committee stage for who specifically gains new rights or obligations.`);
    }
    return bullets.slice(0, 5);
  }

  private buildArguments(haystack: string): { argumentsFor: string[]; argumentsAgainst: string[] } {
    const argumentsFor: string[] = [];
    const argumentsAgainst: string[] = [];

    if (/(startup|tech|innovation)/.test(haystack)) {
      argumentsFor.push('Proponents argue that access to patient capital is the single biggest blocker for indigenous tech firms competing with foreign-funded rivals.');
      argumentsAgainst.push('Critics warn that sectoral levies on telecom operators are typically passed through to consumers as higher data costs.');
    }
    if (/(election|inec|bvas)/.test(haystack)) {
      argumentsFor.push('Supporters say mandatory electronic transmission removes the manual collation step where most recent disputes have originated.');
      argumentsAgainst.push('Opponents argue that the technology has failed in past elections and statutorily mandating it amplifies that single point of failure.');
    }
    if (/(security|interception|surveillance)/.test(haystack)) {
      argumentsFor.push('The executive argues a clear legal framework is needed because interception is already happening informally without judicial oversight.');
      argumentsAgainst.push('Civil society warns that expanded interception powers historically chill press freedom and political organising, even with court oversight.');
    }
    if (/(health|maternal|antenatal)/.test(haystack)) {
      argumentsFor.push('Health advocates say guaranteed care for pregnant women and under-fives is the most cost-effective intervention for reducing mortality.');
      argumentsAgainst.push('Fiscal conservatives question whether the funding mechanism is realistic given current pressures on the Consolidated Revenue Fund.');
    }
    if (/(speech|cyberstalking|expression)/.test(haystack)) {
      argumentsFor.push('Press freedom groups argue the current law has been routinely abused to detain journalists and silence criticism of officials.');
      argumentsAgainst.push('Some legislators warn that narrowing the offence could leave victims of online harassment without effective recourse.');
    }
    if (/(disability|disabilities)/.test(haystack)) {
      argumentsFor.push('Disability rights groups have advocated for an enforcement body since 2018, arguing the existing law lacks teeth without one.');
      argumentsAgainst.push('Some lawmakers question whether a new agency is the right vehicle, or whether existing human rights bodies could absorb the function.');
    }
    if (/(climate|flood|erosion)/.test(haystack)) {
      argumentsFor.push('Front-line states argue federal climate financing is overdue given the disproportionate burden of flooding and desertification.');
      argumentsAgainst.push('Resource-producing states have raised concerns about earmarking a fixed share of mineral revenues outside the existing derivation formula.');
    }

    if (argumentsFor.length === 0) {
      argumentsFor.push('Sponsors argue the bill addresses a long-standing gap that affects ordinary Nigerians directly.');
    }
    if (argumentsAgainst.length === 0) {
      argumentsAgainst.push('Critics raise concerns about implementation cost, capacity, and the risk of unintended consequences.');
    }
    return { argumentsFor: argumentsFor.slice(0, 3), argumentsAgainst: argumentsAgainst.slice(0, 3) };
  }

  private buildJargon(haystack: string): { term: string; definition: string }[] {
    const all: { term: string; definition: string }[] = [
      { term: 'Bill', definition: 'A proposed law. It only becomes law (an Act) after passing both chambers and receiving the President\'s assent.' },
      { term: 'First Reading', definition: 'The formal introduction of a bill in the chamber. No debate happens at this stage.' },
      { term: 'Second Reading', definition: 'The stage where the chamber debates the general principles of the bill and decides whether to advance it.' },
      { term: 'Committee Stage', definition: 'Where a smaller group of legislators examines the bill in detail, often holds public hearings, and may amend it.' },
      { term: 'Third Reading', definition: 'Final debate and vote on the bill in its amended form.' },
      { term: 'Assent', definition: 'The President\'s signature, which is the final step that turns a passed bill into law.' },
      { term: 'BVAS', definition: 'Bimodal Voter Accreditation System: the INEC device used to verify voters and transmit results.', match: /bvas|inec/ },
      { term: 'Consolidated Revenue Fund', definition: 'The federal account into which most government revenues are paid before appropriation by the National Assembly.', match: /consolidated revenue/ },
      { term: 'Hansard', definition: 'The official transcript of what is said during parliamentary debates.', match: /hansard/ },
    ] as Array<{ term: string; definition: string; match?: RegExp }>;

    const picked = all.filter((entry) => {
      const e = entry as { match?: RegExp };
      return e.match ? e.match.test(haystack) : true;
    });
    return dedupe(picked).slice(0, 6).map(({ term, definition }) => ({ term, definition }));
  }
}
