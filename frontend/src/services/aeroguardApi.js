import { apiRequest } from "./apiClient";

export const createOrUpdateHealthProfile = (payload) =>
  apiRequest("/api/v1/exposure/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getHealthRisk = (userId) =>
  apiRequest(`/api/v1/health/risk/${userId}`);

export const logLocation = (payload) =>
  apiRequest("/api/v1/exposure/log", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getExposureSummary = (userId, targetDate) =>
  apiRequest(`/api/v1/exposure/summary/${userId}`, {
    query: targetDate ? { target_date: targetDate } : undefined,
  });

export const getExposureReport = (userId, targetDate) =>
  apiRequest(`/api/v1/exposure/report/${userId}`, {
    query: targetDate ? { target_date: targetDate } : undefined,
  });

export const getSafeRoute = ({
  startLat,
  startLon,
  endLat,
  endLon,
  travelMode = "walking",
  routeType = "cleanest",
  usePredictedPollution = false,
}) =>
  apiRequest("/api/v1/routes/safe-route", {
    query: {
      start_lat: startLat,
      start_lon: startLon,
      end_lat: endLat,
      end_lon: endLon,
      travel_mode: travelMode,
      route_type: routeType,
      use_predicted_pollution: usePredictedPollution,
    },
  });

export const predictPollution = ({ lat, lon }) =>
  apiRequest("/api/v1/routes/predict-pollution", {
    query: { lat, lon },
  });

export const getPollutionHeatmap = ({
  minLat,
  minLon,
  maxLat,
  maxLon,
  gridSizeM = 300,
  usePredictedPollution = false,
}) =>
  apiRequest("/api/v1/routes/pollution-heatmap", {
    query: {
      min_lat: minLat,
      min_lon: minLon,
      max_lat: maxLat,
      max_lon: maxLon,
      grid_size_m: gridSizeM,
      use_predicted_pollution: usePredictedPollution,
    },
  });

export const getSimulatedSensorsBatch = () => apiRequest("/api/v1/sensors/simulate/batch");

export const getNearbySensors = ({ lat, lon, radiusM = 2500, limit = 15 }) =>
  apiRequest("/api/v1/sensors/nearby", {
    query: {
      lat,
      lon,
      radius_m: radiusM,
      limit,
    },
  });
