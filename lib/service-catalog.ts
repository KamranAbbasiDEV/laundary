export type ServiceCatalogItem = { name: string; description?: string; price?: string; turnaround?: string };

export const defaultServiceCatalog: ServiceCatalogItem[] = [
  { name: 'Wash & Fold', description: 'Everyday laundry service', price: '$2.25 / lb', turnaround: 'Standard' },
  { name: 'Priority Wash & Fold', description: 'Faster turnaround', price: '$3.25 / lb', turnaround: 'Priority' },
  { name: 'Dry Cleaning', description: 'Garments requiring dry cleaning', price: 'From $8 / item', turnaround: 'Standard' }
];

export function normalizeServiceCatalog(value: unknown): ServiceCatalogItem[] {
  if (!Array.isArray(value)) return defaultServiceCatalog;
  const services = value
    .map(item => {
      if (typeof item === 'string') return { name: item.trim() };
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name) return null;
      return {
        name,
        description: typeof row.description === 'string' ? row.description : undefined,
        price: typeof row.price === 'string' ? row.price : undefined,
        turnaround: typeof row.turnaround === 'string' ? row.turnaround : undefined
      };
    })
    .filter((item): item is ServiceCatalogItem => Boolean(item));
  return services.length ? services : defaultServiceCatalog;
}

export function configuredServiceNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => typeof item === 'object' && item && typeof (item as Record<string, unknown>).name === 'string' ? String((item as Record<string, unknown>).name).trim().toLowerCase() : '').filter(Boolean);
}

export function serviceIsConfigured(service: string, value: unknown): boolean {
  const names = configuredServiceNames(value);
  return !names.length || names.includes(service.trim().toLowerCase());
}
