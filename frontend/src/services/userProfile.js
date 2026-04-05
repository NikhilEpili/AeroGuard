export const resolveUserId = (user) => {
  const candidate = Number(user?.backendUserId ?? user?.user_id ?? user?.id);
  if (Number.isFinite(candidate) && candidate > 0 && candidate < 1_000_000) {
    return candidate;
  }

  // Use a stable demo fallback user id if profile bootstrap has not completed yet.
  return 1;
};

export const conditionFlags = (conditions) => ({
  asthma: conditions === "asthma" || conditions === "both",
  heart_disease: conditions === "heart" || conditions === "both",
});
