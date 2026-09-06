export function computeEarnings(views: number, payoutPer1kViews: number): number {
  return Math.floor(views / 1000) * payoutPer1kViews;
}

export function wouldExceedBudget(
  alreadySpent: number,
  additionalEarnings: number,
  totalBudget: number,
): boolean {
  return alreadySpent + additionalEarnings > totalBudget;
}
