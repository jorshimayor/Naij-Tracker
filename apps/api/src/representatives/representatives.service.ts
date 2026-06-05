import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

interface LgaEntry {
  name: string;
  senatorSlug: string | null;
  repsSlug: string | null;
  stateAssemblySlug: string | null;
}

interface StateEntry {
  code: string;
  name: string;
  lgas: LgaEntry[];
}

interface LgaMapping {
  _meta: { note: string; lastUpdated: string };
  states: StateEntry[];
}

@Injectable()
export class RepresentativesService {
  private mappingCache: LgaMapping | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async loadMapping(): Promise<LgaMapping> {
    if (this.mappingCache) return this.mappingCache;
    const path = join(__dirname, '..', '..', '..', '..', 'prisma', 'fixtures', 'lga-mapping.json');
    const raw = await readFile(path, 'utf-8');
    this.mappingCache = JSON.parse(raw) as LgaMapping;
    return this.mappingCache;
  }

  async listStates() {
    const mapping = await this.loadMapping();
    return {
      meta: mapping._meta,
      states: mapping.states.map((s) => ({
        code: s.code,
        name: s.name,
        lgaCount: s.lgas.length,
        lgas: s.lgas.map((l) => l.name),
      })),
    };
  }

  async lookup(stateInput: string, lgaInput: string) {
    const mapping = await this.loadMapping();
    const state = mapping.states.find(
      (s) =>
        s.code.toLowerCase() === stateInput.toLowerCase() ||
        s.name.toLowerCase() === stateInput.toLowerCase(),
    );
    if (!state) throw new NotFoundException(`State "${stateInput}" not in v0 dataset`);

    const lga = state.lgas.find((l) => l.name.toLowerCase() === lgaInput.toLowerCase());
    if (!lga) throw new NotFoundException(`LGA "${lgaInput}" not found in ${state.name}`);

    const slugs = [lga.senatorSlug, lga.repsSlug, lga.stateAssemblySlug].filter((s): s is string => !!s);
    const legislators =
      slugs.length === 0
        ? []
        : await this.prisma.legislator.findMany({
            where: { slug: { in: slugs } },
            include: {
              sponsorships: {
                include: {
                  bill: {
                    select: {
                      billNumber: true,
                      title: true,
                      slug: true,
                      currentStage: true,
                      jurisdiction: { select: { slug: true, name: true } },
                    },
                  },
                },
                orderBy: { bill: { lastActionDate: 'desc' } },
                take: 3,
              },
            },
          });
    const bySlug = new Map(legislators.map((l) => [l.slug, l]));

    return {
      meta: mapping._meta,
      state: { code: state.code, name: state.name },
      lga: lga.name,
      senator: lga.senatorSlug ? this.serialize(bySlug.get(lga.senatorSlug)) : null,
      representative: lga.repsSlug ? this.serialize(bySlug.get(lga.repsSlug)) : null,
      stateAssemblyMember: lga.stateAssemblySlug ? this.serialize(bySlug.get(lga.stateAssemblySlug)) : null,
    };
  }

  /**
   * Per-state aggregated counts used by the /states map. Counts are:
   *   - bills:      bills in this state's STATE_ASSEMBLY / FCT_ASSEMBLY jurisdiction
   *   - senators:   legislators in chamber=federal-senate with matching state name
   *   - reps:       legislators in chamber=federal-reps with matching state name
   *   - indicators: state-level indicators (v0 has none; placeholder for future state indicators)
   *
   * Matches by state name (case-insensitive). The 36 + FCT canonical list lives in
   * apps/web/lib/data/states.ts; the API doesn't need its own copy because we just return
   * whatever name the DB has stored.
   */
  async stateStats() {
    const [legislators, stateAssemblyJurisdictions] = await Promise.all([
      this.prisma.legislator.findMany({
        where: { state: { not: null } },
        select: { state: true, chamber: true },
      }),
      this.prisma.jurisdiction.findMany({
        where: { type: { in: ['STATE_ASSEMBLY', 'FCT_ASSEMBLY'] } },
        select: { id: true, name: true, stateCode: true, _count: { select: { bills: true } } },
      }),
    ]);

    // Aggregate legislator counts by (state, chamber).
    const senators = new Map<string, number>();
    const reps = new Map<string, number>();
    for (const l of legislators) {
      if (!l.state) continue;
      const key = l.state.toLowerCase();
      if (l.chamber === 'federal-senate') senators.set(key, (senators.get(key) ?? 0) + 1);
      else if (l.chamber === 'federal-reps') reps.set(key, (reps.get(key) ?? 0) + 1);
    }

    // Aggregate state-assembly bills by state name.
    const bills = new Map<string, number>();
    for (const j of stateAssemblyJurisdictions) {
      const key = j.name.replace(/\s+House of Assembly$/i, '').replace(/\s+Assembly$/i, '').toLowerCase();
      bills.set(key, (bills.get(key) ?? 0) + j._count.bills);
    }

    return {
      // Return as a flat array keyed by lowercased state name; caller resolves to ISO codes
      // by looking up against its canonical list.
      states: Array.from(
        new Set([...senators.keys(), ...reps.keys(), ...bills.keys()]),
      ).map((name) => ({
        nameKey: name,
        senators: senators.get(name) ?? 0,
        reps: reps.get(name) ?? 0,
        bills: bills.get(name) ?? 0,
        indicators: 0,
      })),
    };
  }

  /**
   * State detail used by /states/[slug]. Returns legislators (senate + reps + state assembly
   * if the bill tracker has any), recent bills tagged to that state's jurisdiction, and any
   * state-level indicators (v0: none).
   */
  async stateDetail(stateName: string) {
    const nameLc = stateName.toLowerCase();

    const [senators, reps, stateAssemblyJurisdictions] = await Promise.all([
      this.prisma.legislator.findMany({
        where: { chamber: 'federal-senate', state: { equals: stateName, mode: 'insensitive' } },
        orderBy: { fullName: 'asc' },
        select: {
          slug: true, fullName: true, party: true, constituency: true, photoUrl: true,
          contactEmail: true, state: true,
        },
      }),
      this.prisma.legislator.findMany({
        where: { chamber: 'federal-reps', state: { equals: stateName, mode: 'insensitive' } },
        orderBy: { fullName: 'asc' },
        select: {
          slug: true, fullName: true, party: true, constituency: true, photoUrl: true,
          contactEmail: true, state: true,
        },
      }),
      this.prisma.jurisdiction.findMany({
        where: {
          type: { in: ['STATE_ASSEMBLY', 'FCT_ASSEMBLY'] },
          name: { contains: stateName, mode: 'insensitive' },
        },
        select: { id: true, slug: true, name: true },
      }),
    ]);

    const assemblyIds = stateAssemblyJurisdictions.map((j) => j.id);
    const stateAssemblyBills = assemblyIds.length
      ? await this.prisma.bill.findMany({
          where: { jurisdictionId: { in: assemblyIds } },
          orderBy: { lastActionDate: 'desc' },
          take: 10,
          select: {
            billNumber: true, title: true, slug: true, currentStage: true,
            jurisdiction: { select: { slug: true, name: true } },
            lastActionDate: true,
          },
        })
      : [];

    return {
      state: stateName,
      senators,
      reps,
      stateAssemblies: stateAssemblyJurisdictions,
      stateAssemblyBills,
      // Reserved — state-level indicator slug pattern would be e.g. `igr-${slug}` once seeded.
      indicators: [] as { slug: string; name: string }[],
      _matchedNameLc: nameLc,
    };
  }

  private serialize(leg: any) {
    if (!leg) return null;
    return {
      slug: leg.slug,
      fullName: leg.fullName,
      party: leg.party,
      chamber: leg.chamber,
      constituency: leg.constituency,
      state: leg.state,
      contactEmail: leg.contactEmail,
      recentBills: leg.sponsorships.map((s: any) => ({
        billNumber: s.bill.billNumber,
        title: s.bill.title,
        slug: s.bill.slug,
        currentStage: s.bill.currentStage,
        jurisdiction: s.bill.jurisdiction,
      })),
    };
  }
}
