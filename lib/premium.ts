export function hasPremiumAccess(
  subscription: { status: string; currentPeriodEnd: Date } | null,
): boolean {
  return (
    !!subscription &&
    ["ACTIVE", "TRIALING"].includes(subscription.status) &&
    subscription.currentPeriodEnd > new Date()
  );
}
