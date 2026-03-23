const hashStringToInt = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1;
};

export const resolveUserId = (user) => {
  if (user?.backendUserId && Number.isFinite(Number(user.backendUserId))) {
    return Number(user.backendUserId);
  }

  const seed = `${user?.email || ""}|${user?.name || ""}`.trim();
  if (!seed) return 1;
  return hashStringToInt(seed);
};

export const conditionFlags = (conditions) => ({
  asthma: conditions === "asthma" || conditions === "both",
  heart_disease: conditions === "heart" || conditions === "both",
});
