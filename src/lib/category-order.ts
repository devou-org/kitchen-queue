/**
 * Utility to sort product categories based on configured database sort_order.
 */

export interface ConfiguredCategory {
  id?: string;
  name: string;
  sort_order?: number;
}

export function sortCategoriesByConfig(
  productCategoryNames: string[],
  configuredCategories: ConfiguredCategory[]
): string[] {
  const orderMap = new Map<string, number>();
  
  configuredCategories.forEach((cat, index) => {
    orderMap.set(cat.name.trim().toLowerCase(), cat.sort_order !== undefined ? Number(cat.sort_order) : index * 10);
  });

  const unique = Array.from(
    new Set(
      productCategoryNames
        .map(c => c?.trim())
        .filter(c => c && c.toLowerCase() !== 'all')
    )
  );

  unique.sort((a, b) => {
    const orderA = orderMap.get(a.toLowerCase());
    const orderB = orderMap.get(b.toLowerCase());

    if (orderA !== undefined && orderB !== undefined) {
      return orderA - orderB;
    }
    if (orderA !== undefined) return -1;
    if (orderB !== undefined) return 1;
    return a.localeCompare(b);
  });

  return unique;
}
