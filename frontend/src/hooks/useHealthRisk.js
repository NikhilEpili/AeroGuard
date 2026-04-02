import { useQuery } from "@tanstack/react-query";
import { getHealthRisk } from "../services/aeroguardApi";

export const useHealthRisk = (userId) =>
  useQuery({
    queryKey: ["healthRisk", userId],
    queryFn: () => getHealthRisk(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
