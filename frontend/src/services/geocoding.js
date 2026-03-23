export const geocodeLocation = async (place) => {
  if (!place?.trim()) return null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`
    );
    const data = await res.json();

    if (data?.[0]) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (error) {
    console.error("Geocode failed", error);
  }

  return null;
};

export const reverseGeocode = async (lat, lon) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
    );
    const data = await res.json();
    return data?.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch (error) {
    console.error("Reverse geocode failed", error);
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
};
