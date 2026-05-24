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
