import { canonicalizeSkillName, skillNamesMatch } from '../domain/skills';
import { addDays, daysBetween, startOfToday } from '../domain/staffing';

export const DEFAULT_HORIZON_WEEKS = 8;
export const MAX_HORIZON_WEEKS = 26;
export const RECOMMENDATIONS_PER_OPENING = 3;
export const LONG_BENCH_DAYS = 30;

export type RecommendationConfidence = 'strong' | 'partial' | 'weak';

export interface ForecastSkill {
  name: string;
  level: string;
  yearsExp: number;
}

export interface ForecastAssignment {
  clientId: string;
  clientName: string;
  clientIndustry: string;
  startDate: Date;
  endDate: Date | null;
  status: string;
}

export interface ForecastDeveloper {
  id: string;
  name: string;
  role: string;
  seniority: string;
  benchSince: Date | null;
  skills: ForecastSkill[];
  assignments: ForecastAssignment[];
  performance?: { clientRating: number | null; codeQuality: number } | null;
}

export interface ForecastContract {
  id: string;
  developerId: string;
  clientId: string;
  clientName: string;
  clientIndustry: string;
  startDate: Date;
  endDate: Date;
  status: string;
  billingRate: number;
}

export interface ForecastOpening {
  contractId: string;
  developerId: string;
  developer: string;
  developerSeniority: string;
  clientId: string;
  client: string;
  clientIndustry: string;
  endDate: string;
  daysUntilEnd: number;
  renewalLikely: boolean;
  requiredSkills: Array<{ name: string; level: string }>;
  recommendations: ForecastRecommendation[];
}

export interface ForecastRecommendation {
  developerId: string;
  name: string;
  seniority: string;
  score: number;
  confidence: RecommendationConfidence;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  availableFrom: string | null;
}

export interface ForecastWeek {
  weekStart: string;
  weekEnd: string;
  onBench: number;
  openings: number;
  utilizationRate: number;
}

export interface ForecastBenchMember {
  developerId: string;
  name: string;
  seniority: string;
  benchSince: string | null;
  benchDays: number;
  skills: string[];
}

export interface CapacityForecast {
  horizonWeeks: number;
  generatedAt: string;
  today: string;
  summary: {
    developers: number;
    onBenchNow: number;
    benchOver30Days: number;
    openings: number;
    clientsAffected: number;
    projectedBench: number;
    projectedUtilization: number;
    openingsWithRecommendations: number;
  };
  timeline: ForecastWeek[];
  openings: ForecastOpening[];
  benchPool: ForecastBenchMember[];
}

export interface DeveloperAvailability {
  /** First day the developer is free. `null` means occupied with no known end. */
  freeFrom: Date | null;
  onBenchNow: boolean;
}

const SENIORITY_ORDER = ['junior', 'mid', 'senior', 'lead'] as const;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function levelScore(level: string): number {
  switch (level) {
    case 'expert':
      return 30;
    case 'advanced':
      return 25;
    case 'intermediate':
      return 15;
    default:
      return 5;
  }
}

function isAdjacentSeniority(left: string, right: string): boolean {
  const leftIndex = SENIORITY_ORDER.indexOf(left as (typeof SENIORITY_ORDER)[number]);
  const rightIndex = SENIORITY_ORDER.indexOf(right as (typeof SENIORITY_ORDER)[number]);
  if (leftIndex === -1 || rightIndex === -1) return false;
  return Math.abs(leftIndex - rightIndex) === 1;
}

/**
 * Determines when a developer becomes available. An assignment without an end
 * date keeps the developer occupied for the whole horizon.
 */
export function availabilityFor(developer: ForecastDeveloper, today: Date): DeveloperAvailability {
  const occupied = developer.assignments.filter(
    (assignment) =>
      (assignment.status === 'active' ||
        assignment.status === 'ending' ||
        assignment.status === 'transition') &&
      assignment.startDate <= today &&
      (assignment.endDate === null || assignment.endDate >= today),
  );

  if (occupied.length === 0) return { freeFrom: today, onBenchNow: true };
  if (occupied.some((assignment) => assignment.endDate === null)) {
    return { freeFrom: null, onBenchNow: false };
  }

  const lastEnd = occupied.reduce(
    (latest, assignment) =>
      assignment.endDate && assignment.endDate > latest ? assignment.endDate : latest,
    occupied[0]?.endDate ?? today,
  );
  // The developer is occupied through the assignment end date and free the
  // following day.
  return { freeFrom: addDays(lastEnd, 1), onBenchNow: false };
}

export interface ForecastWeekInput {
  weekStart: Date;
  weekEnd: Date;
  onBench: number;
  openings: number;
  utilizationRate: number;
}

/**
 * Builds the weekly supply and demand curve. Developers become bench capacity
 * once their current assignment has ended, and each contract that expires
 * inside a week is counted as an opening for that week.
 */
export function buildTimeline(
  developers: ForecastDeveloper[],
  openings: Array<{ endDate: Date }>,
  today: Date,
  weeks: number,
): ForecastWeek[] {
  const availability = developers.map((developer) => availabilityFor(developer, today));
  const total = developers.length;

  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = addDays(today, index * 7);
    const weekEnd = addDays(weekStart, 6);
    const onBench = availability.filter(
      (entry) => entry.freeFrom !== null && entry.freeFrom <= weekStart,
    ).length;
    const weekOpenings = openings.filter(
      (opening) => opening.endDate >= weekStart && opening.endDate <= weekEnd,
    ).length;

    return {
      weekStart: isoDate(weekStart),
      weekEnd: isoDate(weekEnd),
      onBench,
      openings: weekOpenings,
      utilizationRate: total > 0 ? Math.round(((total - onBench) / total) * 100) : 0,
    };
  });
}

export interface CandidateScore {
  score: number;
  confidence: RecommendationConfidence;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  availableFrom: Date | null;
}

/**
 * Scores a candidate for a backfill against the developer who is leaving.
 * Skill overlap with the departing developer and availability at the opening
 * date matter most; industry history, seniority, bench duration, and recent
 * performance break ties.
 */
export function scoreCandidate(
  candidate: ForecastDeveloper,
  opening: {
    clientId: string;
    clientName: string;
    clientIndustry: string;
    endDate: Date;
    requiredSkills: Array<{ name: string; level: string }>;
    developerSeniority: string;
  },
  today: Date,
): CandidateScore {
  let score = 0;
  const reasons: string[] = [];
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const required of opening.requiredSkills) {
    const match = candidate.skills.find((skill) => skillNamesMatch(skill.name, required.name));
    if (!match) {
      missingSkills.push(required.name);
      continue;
    }
    matchedSkills.push(match.name);
    score += levelScore(match.level);
    reasons.push(`${match.name} (${match.level})`);
  }

  if (opening.requiredSkills.length > 0 && missingSkills.length === 0) {
    score += 20;
    reasons.push('Matches every skill of the outgoing developer');
  } else {
    score -= missingSkills.length * 5;
  }

  const availability = availabilityFor(candidate, today);
  if (availability.freeFrom === null) {
    score -= 15;
    reasons.push('Current assignment has no confirmed end date');
  } else if (availability.onBenchNow) {
    score += 20;
    reasons.push('On bench - available immediately');
  } else if (availability.freeFrom <= opening.endDate) {
    score += 15;
    reasons.push(`Current assignment ends ${isoDate(availability.freeFrom)}`);
  } else {
    score -= 10;
    reasons.push('Still assigned when the opening starts');
  }

  if (candidate.assignments.some((assignment) => assignment.clientId === opening.clientId)) {
    score += 15;
    reasons.push(`Has ${opening.clientName} experience`);
  }

  const openingIndustry = canonicalizeSkillName(opening.clientIndustry);
  if (
    openingIndustry.length > 0 &&
    candidate.assignments.some(
      (assignment) => canonicalizeSkillName(assignment.clientIndustry) === openingIndustry,
    )
  ) {
    score += 10;
    reasons.push(`Has ${opening.clientIndustry} industry experience`);
  }

  if (candidate.seniority === opening.developerSeniority) {
    score += 10;
    reasons.push(`Matches the ${opening.developerSeniority} level`);
  } else if (isAdjacentSeniority(candidate.seniority, opening.developerSeniority)) {
    score += 5;
    reasons.push(`Close to the ${opening.developerSeniority} level`);
  }

  if (availability.onBenchNow && candidate.benchSince) {
    const benchDays = Math.max(0, daysBetween(candidate.benchSince, today));
    if (benchDays > 0) {
      score += Math.min(15, Math.floor(benchDays / 30) * 5);
      reasons.push(`On the bench for ${benchDays} days`);
    }
  }

  if ((candidate.performance?.clientRating ?? 0) >= 4) {
    score += 10;
    reasons.push(`High performer (${candidate.performance?.clientRating}/5)`);
  }
  if ((candidate.performance?.codeQuality ?? 0) >= 90) {
    score += 5;
    reasons.push('Strong code quality');
  }

  const confidence: RecommendationConfidence =
    matchedSkills.length === 0 ? 'weak' : missingSkills.length === 0 ? 'strong' : 'partial';

  return {
    score,
    confidence,
    matchedSkills,
    missingSkills,
    reasons,
    availableFrom: availability.freeFrom,
  };
}

export interface BuildForecastInput {
  developers: ForecastDeveloper[];
  contracts: ForecastContract[];
  today?: Date;
  weeks?: number;
  recommendationLimit?: number;
  clientId?: string;
}

/**
 * Produces the full capacity forecast: a weekly supply and demand curve, the
 * contracts that open up inside the horizon, and ranked backfill candidates
 * for every opening.
 */
export function buildForecast(input: BuildForecastInput): CapacityForecast {
  const today = startOfToday(input.today ?? new Date());
  const weeks = Math.min(
    MAX_HORIZON_WEEKS,
    Math.max(1, Math.floor(input.weeks ?? DEFAULT_HORIZON_WEEKS)),
  );
  const recommendationLimit = input.recommendationLimit ?? RECOMMENDATIONS_PER_OPENING;
  const horizonEnd = addDays(today, weeks * 7);

  const developersById = new Map(input.developers.map((developer) => [developer.id, developer]));

  const openingContracts = input.contracts
    .filter(
      (contract) =>
        (contract.status === 'active' || contract.status === 'renewing') &&
        contract.startDate <= today &&
        contract.endDate >= today &&
        contract.endDate <= horizonEnd &&
        (input.clientId === undefined || contract.clientId === input.clientId),
    )
    .sort((left, right) => left.endDate.getTime() - right.endDate.getTime());

  const openings: ForecastOpening[] = openingContracts.map((contract) => {
    const outgoing = developersById.get(contract.developerId);
    const requiredSkills = (outgoing?.skills ?? []).map((skill) => ({
      name: skill.name,
      level: skill.level,
    }));

    const candidates = input.developers
      .filter((developer) => developer.id !== contract.developerId)
      .map((developer) => ({
        developer,
        scored: scoreCandidate(
          developer,
          {
            clientId: contract.clientId,
            clientName: contract.clientName,
            clientIndustry: contract.clientIndustry,
            endDate: contract.endDate,
            requiredSkills,
            developerSeniority: outgoing?.seniority ?? 'mid',
          },
          today,
        ),
      }))
      // Candidates who cannot start before the opening starts are not useful
      // backfills, so they are dropped instead of ranked low.
      .filter(
        (entry) =>
          entry.scored.availableFrom !== null && entry.scored.availableFrom <= contract.endDate,
      )
      .sort((left, right) => {
        if (right.scored.score !== left.scored.score) {
          return right.scored.score - left.scored.score;
        }
        return left.developer.name.localeCompare(right.developer.name);
      })
      .slice(0, recommendationLimit)
      .map((entry) => ({
        developerId: entry.developer.id,
        name: entry.developer.name,
        seniority: entry.developer.seniority,
        score: entry.scored.score,
        confidence: entry.scored.confidence,
        matchedSkills: entry.scored.matchedSkills,
        missingSkills: entry.scored.missingSkills,
        reasons: entry.scored.reasons,
        availableFrom: entry.scored.availableFrom ? isoDate(entry.scored.availableFrom) : null,
      }));

    return {
      contractId: contract.id,
      developerId: contract.developerId,
      developer: outgoing?.name ?? 'Unknown developer',
      developerSeniority: outgoing?.seniority ?? 'unknown',
      clientId: contract.clientId,
      client: contract.clientName,
      clientIndustry: contract.clientIndustry,
      endDate: isoDate(contract.endDate),
      daysUntilEnd: daysBetween(today, contract.endDate),
      renewalLikely: contract.status === 'renewing',
      requiredSkills,
      recommendations: candidates,
    };
  });

  const timeline = buildTimeline(
    input.developers,
    openingContracts.map((contract) => ({ endDate: contract.endDate })),
    today,
    weeks,
  );

  const benchPool = input.developers
    .filter((developer) => availabilityFor(developer, today).onBenchNow)
    .map((developer) => ({
      developerId: developer.id,
      name: developer.name,
      seniority: developer.seniority,
      benchSince: developer.benchSince ? isoDate(developer.benchSince) : null,
      benchDays: developer.benchSince ? Math.max(0, daysBetween(developer.benchSince, today)) : 0,
      skills: developer.skills.map((skill) => skill.name),
    }))
    .sort((left, right) => right.benchDays - left.benchDays || left.name.localeCompare(right.name));

  const lastWeek = timeline[timeline.length - 1];
  const clientsAffected = new Set(openings.map((opening) => opening.clientId)).size;

  return {
    horizonWeeks: weeks,
    generatedAt: new Date().toISOString(),
    today: isoDate(today),
    summary: {
      developers: input.developers.length,
      onBenchNow: benchPool.length,
      benchOver30Days: benchPool.filter((member) => member.benchDays > LONG_BENCH_DAYS).length,
      openings: openings.length,
      clientsAffected,
      projectedBench: lastWeek?.onBench ?? benchPool.length,
      projectedUtilization: lastWeek?.utilizationRate ?? 0,
      openingsWithRecommendations: openings.filter((opening) => opening.recommendations.length > 0)
        .length,
    },
    timeline,
    openings,
    benchPool,
  };
}
