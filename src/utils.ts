export function determineLocale(request, url) {
  const acceptLanguage = request.headers.get("Accept-Language") || ""
  const defaultLocale = { ietf: "en-US", language: "en", country: "US", prefix: "" }

  const pathParts = url.pathname.split("/").filter(Boolean)
  if (pathParts.length > 0) {
    const possibleLocale = pathParts[0].toLowerCase()
    if (/^[a-z]{2}(-[a-z]{2})?$/.test(possibleLocale)) {
      const [language, country] = possibleLocale.split("-")
      return {
        ietf: possibleLocale,
        language,
        country: country ? country.toUpperCase() : undefined,
        prefix: `/${language}${country ? `-${country}` : ""}`,
      }
    }
  }

  if (acceptLanguage) {
    const preferredLocale = acceptLanguage.split(",")[0].trim()
    if (preferredLocale.includes("-")) {
      const [language, country] = preferredLocale.split("-")
      return {
        ietf: preferredLocale,
        language,
        country: country.toUpperCase(),
        prefix: `/${language}-${country.toLowerCase()}`,
      }
    }
  }

  return defaultLocale
}

export const shouldPersonalize = (request: Request): Boolean => {
  const url = new URL(request.url);
  return url.searchParams.has("edge-pers") ||
    url.searchParams.get("target") === "on" ||
    url.searchParams.get("hybrid-pers") === "on" ||
    url.searchParams.get("hybrid_test") === "true" ||
    url.searchParams.get("perf_test") === "true"
};

