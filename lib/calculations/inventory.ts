// Calcul de l'inventaire restant (§4 du PROJECT_PLAN : stock = SUM(catches)
// − SUM(sales) par trip+fish_category+fish_quality). Fonctions pures,
// testables sans DB — voir inventory.test.ts.

export interface CatchQuantity {
  fishCategoryId: string;
  fishQualityLevelId: string;
  quantity: number;
}

export interface SaleQuantity {
  fishCategoryId: string;
  fishQualityLevelId: string;
  quantity: number;
}

export interface StockGroup {
  fishCategoryId: string;
  fishQualityLevelId: string;
  caughtQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
}

function groupKey(fishCategoryId: string, fishQualityLevelId: string): string {
  return `${fishCategoryId}:${fishQualityLevelId}`;
}

// Regroupe les captures et ventes par (fish_category, fish_quality) et
// calcule le stock restant de chaque groupe.
export function computeRemainingStock(
  catches: CatchQuantity[],
  sales: SaleQuantity[],
): StockGroup[] {
  const groups = new Map<string, StockGroup>();

  for (const c of catches) {
    const key = groupKey(c.fishCategoryId, c.fishQualityLevelId);
    const existing = groups.get(key);
    if (existing) {
      existing.caughtQuantity += c.quantity;
    } else {
      groups.set(key, {
        fishCategoryId: c.fishCategoryId,
        fishQualityLevelId: c.fishQualityLevelId,
        caughtQuantity: c.quantity,
        soldQuantity: 0,
        remainingQuantity: 0,
      });
    }
  }

  for (const s of sales) {
    const key = groupKey(s.fishCategoryId, s.fishQualityLevelId);
    const existing = groups.get(key);
    if (existing) {
      existing.soldQuantity += s.quantity;
    } else {
      // Vente sans capture correspondante dans le jeu de données fourni :
      // ne devrait pas arriver via l'UI (validée à l'entrée), mais reflété
      // quand même plutôt que silencieusement ignoré.
      groups.set(key, {
        fishCategoryId: s.fishCategoryId,
        fishQualityLevelId: s.fishQualityLevelId,
        caughtQuantity: 0,
        soldQuantity: s.quantity,
        remainingQuantity: 0,
      });
    }
  }

  for (const group of groups.values()) {
    group.remainingQuantity = group.caughtQuantity - group.soldQuantity;
  }

  return Array.from(groups.values());
}

export function remainingStockFor(
  catches: CatchQuantity[],
  sales: SaleQuantity[],
  fishCategoryId: string,
  fishQualityLevelId: string,
): number {
  const group = computeRemainingStock(catches, sales).find(
    (g) =>
      g.fishCategoryId === fishCategoryId && g.fishQualityLevelId === fishQualityLevelId,
  );
  return group?.remainingQuantity ?? 0;
}

export class InsufficientStockError extends Error {}

// §7 : la quantité vendue ne peut pas dépasser le stock restant pour la
// combinaison trip+fish+quality.
export function assertQuantityWithinStock(
  catches: CatchQuantity[],
  sales: SaleQuantity[],
  fishCategoryId: string,
  fishQualityLevelId: string,
  requestedQuantity: number,
): void {
  const remaining = remainingStockFor(catches, sales, fishCategoryId, fishQualityLevelId);
  if (requestedQuantity > remaining) {
    throw new InsufficientStockError(
      `الكمية المطلوبة (${requestedQuantity}) تتجاوز المخزون المتبقي (${remaining}).`,
    );
  }
}
