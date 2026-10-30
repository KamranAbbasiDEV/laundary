type MatchingWeights = Record<'capability' | 'capacity' | 'turnaround' | 'pricing' | 'performance', number>;

export type ProcessorCandidate = {
  id: string;
  capabilities: unknown;
  capacity_limit: number | string | null;
  capacity_percent: number | string | null;
  turnaround_hours: number | string | null;
  pricing: unknown;
  performance_score: number | string | null;
};

const defaults: MatchingWeights = { capability: 30, capacity: 20, turnaround: 15, pricing: 10, performance: 5 };
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function rankEligibleProcessors(candidates: ProcessorCandidate[], serviceType: string, configuredRules: unknown) {
  const configured = configuredRules && typeof configuredRules === 'object' && !Array.isArray(configuredRules)
    ? configuredRules as Record<string, unknown>
    : {};
  const weights = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof MatchingWeights>) {
    const value = configured[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) weights[key] = value;
  }
  const service = normalize(serviceType);

  return candidates.flatMap(candidate => {
    const capabilities = Array.isArray(candidate.capabilities) ? candidate.capabilities.map(normalize).filter(Boolean) : [];
    const supportsService = Boolean(service) && capabilities.some(value => service.includes(value) || value.includes(service));
    const hasCapacity = Number(candidate.capacity_limit) > 0 && Number(candidate.capacity_percent) < 100;
    if (!supportsService || !hasCapacity) return [];

    const turnaroundHours = Number(candidate.turnaround_hours ?? 0);
    const breakdown = {
      capability: weights.capability,
      capacity: weights.capacity,
      turnaround: turnaroundHours > 0 ? Math.max(0, weights.turnaround * (1 - Math.min(turnaroundHours, 96) / 96)) : 0,
      pricing: candidate.pricing ? weights.pricing : 0,
      performance: Math.max(0, Math.min(100, Number(candidate.performance_score ?? 0))) / 100 * weights.performance
    };
    return [{ id: candidate.id, score: Object.values(breakdown).reduce((total, value) => total + value, 0), turnaround: turnaroundHours || 999, breakdown }];
  }).sort((a, b) => b.score - a.score || a.turnaround - b.turnaround);
}
