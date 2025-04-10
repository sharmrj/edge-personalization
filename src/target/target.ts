import { AuthState } from "../authenticate/authenticate";
import { determineLocale } from "../utils";
import { parseRawData } from "./parse-target-data";

export type ProcessedData = { [key: string]: unknown };

export async function getPersonalizationData(request: Request, authState: AuthState): Promise<ProcessedData> {
  console.log("Making Interact Call");
  const rawData = await fetchPersonalizationData(request, authState);
  return parseRawData(rawData);
}

async function fetchPersonalizationData(request: Request, authState): Promise<unknown> {
  const url = new URL(request.url);
  const env = [
    "stage",
    "dev",
    "test",
    "localhost",
    ".page",
    ".live"
  ].some(str => url.hostname.includes(str)) ? "stage" : "prod"
  const locale = determineLocale(request, url);
  // Define constants based on environment
  const DATA_STREAM_ID =
    env === "prod" ? "913eac4d-900b-45e8-9ee7-306216765cd2" : "e065836d-be57-47ef-b8d1-999e1657e8fd"
  const TARGET_API_URL = `https://edge.adobedc.net/ee/v2/interact`
  //   const TARGET_API_URL = `https://sstats.adobe.com/ee/ind1/v1/interact`

  // Get device info (server-side adaptation)
  const deviceInfo = {
    screenWidth: 1920,
    screenHeight: 1080,
    screenOrientation: "landscape",
    viewportWidth: 1920,
    viewportHeight: 1080,
  }

  // Get current date and time
  const CURRENT_DATE = new Date()
  const localTime = CURRENT_DATE.toISOString()
  const timezoneOffset = CURRENT_DATE.getTimezoneOffset()

  // Create updated context
  const updatedContext = {
    device: {
      screenHeight: deviceInfo.screenHeight,
      screenWidth: deviceInfo.screenWidth,
      screenOrientation: deviceInfo.screenOrientation,
    },
    environment: {
      type: "browser",
      browserDetails: {
        viewportWidth: deviceInfo.viewportWidth,
        viewportHeight: deviceInfo.viewportHeight,
      },
    },
    placeContext: {
      localTime,
      localTimezoneOffset: timezoneOffset,
    },
  }

  // Get page name for analytics
  const pageName = `${locale.ietf}:${url.pathname.replace(/^\//, "").replace(/\/$/, "") || "home"}`

  // Create request payload
  const requestBody = createRequestPayload({
    updatedContext,
    pageName,
    locale,
    env,
    url,
    request,
    DATA_STREAM_ID,
    authState,
  })

  // Make the request to Adobe Target
  const targetResp = await fetch(`${TARGET_API_URL}?dataStreamId=${DATA_STREAM_ID}&requestId=${generateUUIDv4()}`, {
    method: "POST",
    body: JSON.stringify(requestBody),
  })

  if (!targetResp.ok) {
    throw new Error(`Failed to fetch interact call: ${targetResp.status} ${targetResp.statusText}`)
  }

  return await targetResp.json()
};

// Create request payload for Adobe Target
function createRequestPayload({ updatedContext, pageName, locale, env, url, request, DATA_STREAM_ID, authState }) {
  const cookieHeader = request.headers.get("Cookie") || ""
  const cookies = {}

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.trim().split("=")
    if (parts.length >= 2) {
      const key = parts[0].trim()
      const value = parts.slice(1).join("=").trim()
      cookies[key] = value
    }
  })
  const prevPageName = cookies['gpv']
  // const snrCookie = cookies['s_nr']
  // const martechCookie = cookies[KNDCTR_COOKIE_KEYS]

  const AT_PROPERTY_VAL = getTargetPropertyBasedOnPageRegion({ env, pathname: url.pathname })
  const REPORT_SUITES_ID = env === "prod" ? ["adbadobenonacdcprod"] : ["adbadobenonacdcqa"]

  // Extract ECID from cookies if available
  const AMCV_COOKIE = 'AMCV_9E1005A551ED61CA0A490D45@AdobeOrg'
  const amcvCookieValue = cookies[AMCV_COOKIE]
  let identityMap = {
    "ECID": [
      {
        "id": "45929402172259229860503176295453585215",
        "authenticatedState": "ambiguous",
        "primary": true
      }
    ]
  }

  // If ECID is found in cookies, use it
  if (amcvCookieValue && amcvCookieValue.indexOf('MCMID|') !== -1) {
    const ecid = amcvCookieValue.match(/MCMID\|([^|]+)/)?.[1]
    if (ecid) {
      identityMap = {
        "ECID": [
          {
            "id": ecid,
            "authenticatedState": "ambiguous",
            "primary": true
          }
        ]
      }
    }
  }

  // Get state entries from cookies
  const KNDCTR_COOKIE_KEYS = [
    'kndctr_9E1005A551ED61CA0A490D45_AdobeOrg_identity',
    'kndctr_9E1005A551ED61CA0A490D45_AdobeOrg_cluster',
  ]

  const stateEntries = Object.entries(cookies)
    .filter(([key]) => KNDCTR_COOKIE_KEYS.includes(key))
    .map(([key, value]) => ({ key, value }))

  return {
    "event": {
      "xdm": {
        ...updatedContext,
        // "identityMap": identityMap,
        "identityMap": getOrGenerateUserId(cookies),
        "web": {
          "webPageDetails": {
            "URL": url.href,
            "siteSection": url.hostname,
            "server": url.hostname,
            "isErrorPage": false,
            "isHomePage": false,
            "name": pageName,
            "pageViews": {
              "value": 0
            }
          },
          webInteraction: {
            name: 'Martech-API',
            type: 'other',
            linkClicks: { value: 1 },
          },
          "webReferrer": {
            "URL": request.headers.get("Referer") || ""
          }
        },
        "timestamp": new Date().toISOString(),
        "eventType": "decisioning.propositionFetch",
      },
      "data": {
        "__adobe": {
          "target": {
            "is404": false,
            "authState": "loggedOut",
            "hitType": "propositionFetch",
            "isMilo": true,
            "adobeLocale": locale.ietf,
            "hasGnav": true,
          }
        },
        "_adobe_corpnew": {
          marketingtech: { adobe: { alloy: { approach: 'martech-API' } } },
          "digitalData": {
            "page": {
              "pageInfo": {
                "language": locale.ietf,
              }
            },
            "diagnostic": {
              "franklin": {
                "implementation": "milo"
              }
            },
            "previousPage": {
              "pageInfo": {
                "pageName": prevPageName
              }
            },
            "primaryUser": {
              "primaryProfile": {
                "profileInfo": authState.data,
                /*"profileInfo": {
                  "authState": "loggedOut",
                  "returningStatus": "Repeat",
                }*/
              }
            },
          }
        },
      }
    },
    "query": {
      "identity": {
        "fetch": [
          "ECID"
        ]
      },
      "personalization": {
        "schemas": [
          "https://ns.adobe.com/personalization/default-content-item",
          "https://ns.adobe.com/personalization/html-content-item",
          "https://ns.adobe.com/personalization/json-content-item",
          "https://ns.adobe.com/personalization/redirect-item",
          "https://ns.adobe.com/personalization/ruleset-item",
          "https://ns.adobe.com/personalization/message/in-app",
          "https://ns.adobe.com/personalization/message/content-card",
          "https://ns.adobe.com/personalization/dom-action"
        ],
        "decisionScopes": [
          '__view__'
        ]
      }
    },
    "meta": {
      "target": {
        "migration": true
      },
      "configOverrides": {
        "com_adobe_analytics": {
          "reportSuites": REPORT_SUITES_ID
        },
        "com_adobe_target": {
          "propertyToken": AT_PROPERTY_VAL
        }
      },
      "state": {
        "domain": url.hostname,
        "cookiesEnabled": true,
        "entries": stateEntries
      }
    }
  }
}

function getTargetPropertyBasedOnPageRegion({ env, pathname }) {
  if (env !== 'prod') return 'bc8dfa27-29cc-625c-22ea-f7ccebfc6231';

  // EMEA & LATAM
  if (
    pathname.search(
      /(\/africa\/|\/be_en\/|\/be_fr\/|\/be_nl\/|\/cis_en\/|\/cy_en\/|\/dk\/|\/de\/|\/ee\/|\/es\/|\/fr\/|\/gr_en\/|\/ie\/|\/il_en\/|\/it\/|\/lv\/|\/lu_de\/|\/lu_en\/|\/lu_fr\/|\/hu\/|\/mt\/|\/mena_en\/|\/nl\/|\/no\/|\/pl\/|\/pt\/|\/ro\/|\/ch_de\/|\/si\/|\/sk\/|\/ch_fr\/|\/fi\/|\/se\/|\/ch_it\/|\/tr\/|\/uk\/|\/at\/|\/cz\/|\/bg\/|\/ru\/|\/cis_ru\/|\/ua\/|\/il_he\/|\/mena_ar\/|\/lt\/|\/sa_en\/|\/ae_en\/|\/ae_ar\/|\/sa_ar\/|\/ng\/|\/za\/|\/qa_ar\/|\/eg_en\/|\/eg_ar\/|\/kw_ar\/|\/eg_ar\/|\/qa_en\/|\/kw_en\/|\/gr_el\/|\/br\/|\/cl\/|\/la\/|\/mx\/|\/co\/|\/ar\/|\/pe\/|\/gt\/|\/pr\/|\/ec\/|\/cr\/)/,
    ) !== -1
  ) {
    return '488edf5f-3cbe-f410-0953-8c0c5c323772';
  }
  if ( // APAC
    pathname.search(
      /(\/au\/|\/hk_en\/|\/in\/|\/nz\/|\/sea\/|\/cn\/|\/hk_zh\/|\/tw\/|\/kr\/|\/sg\/|\/th_en\/|\/th_th\/|\/my_en\/|\/my_ms\/|\/ph_en\/|\/ph_fil\/|\/vn_en\/|\/vn_vi\/|\/in_hi\/|\/id_id\/|\/id_en\/)/,
    ) !== -1
  ) {
    return '3de509ee-bbc7-58a3-0851-600d1c2e2918';
  }
  // JP
  if (pathname.indexOf('/jp/') !== -1) {
    return 'ba5bc9e8-8fb4-037a-12c8-682384720007';
  }

  return '4db35ee5-63ad-59f6-cec6-82ef8863b22d'; // Default
}

const AMCV_COOKIE = 'AMCV_9E1005A551ED61CA0A490D45@AdobeOrg';
function getOrGenerateUserId(cookies) {
  const amcvCookieValue = cookies[AMCV_COOKIE]

  // If ECID is not found, generate and return FPID
  if (!amcvCookieValue || (amcvCookieValue.indexOf('MCMID|') === -1)) {
    const fpidValue = generateUUIDv4();
    return {
      FPID: [{
        id: fpidValue,
        authenticatedState: 'ambiguous',
        primary: true,
      }],
    };
  }

  return {
    ECID: [{
      id: amcvCookieValue.match(/MCMID\|([^|]+)/)?.[1],
      authenticatedState: 'ambiguous',
      primary: true,
    }],
  };
}

function generateUUIDv4() {
  const randomValues = new Uint8Array(16);
  crypto.getRandomValues(randomValues);
  randomValues[6] = (randomValues[6] % 16) + 64;
  randomValues[8] = (randomValues[8] % 16) + 128;
  let uuid = '';
  randomValues.forEach((byte, index) => {
    const hex = byte.toString(16).padStart(2, '0');
    if (index === 4 || index === 6 || index === 8 || index === 10) {
      uuid += '-';
    }
    uuid += hex;
  });

  return uuid;
}

export const sha256 = function (b) {
  function c(a, b) {
    return (a >>> b) | (a << (32 - b));
  }
  for (
    var d, e, f = Math.pow, g = 2 ** 32, h = 'length', i = '', j = [], k = 8 * b[h], l = sha256.h = sha256.h || [], m = sha256.k = sha256.k || [], n = m[h], o = {}, p = 2;
    n < 64;
    p++
  ) {
    if (!o[p]) {
      for (d = 0; d < 313; d += p) o[d] = p;
      l[n] = p ** 0.5 * g | 0;
      m[n++] = p ** (1 / 3) * g | 0;
    }
  }
  for (b += '\x80'; b[h] % 64 - 56;) b += '\x00';
  for (d = 0; d < b[h]; d++) {
    if (((e = b.charCodeAt(d)), e >> 8)) return;
    j[d >> 2] |= e << ((3 - d) % 4) * 8;
  }
  for (j[j[h]] = k / g | 0, j[j[h]] = k, e = 0; e < j[h];) {
    const q = j.slice(e, (e += 16)); const
      r = l;
    for (l = l.slice(0, 8), d = 0; d < 64; d++) {
      const s = q[d - 15];
      const t = q[d - 2];
      const u = l[0];
      const v = l[4];
      const w = l[7] + (c(v, 6) ^ c(v, 11) ^ c(v, 25)) + ((v & l[5]) ^ (~v & l[6])) + m[d] + (q[d] = d < 16 ? q[d] : (q[d - 16] + (c(s, 7) ^ c(s, 18) ^ (s >>> 3)) + q[d - 7] + (c(t, 17) ^ c(t, 19) ^ (t >>> 10))) | 0);
      const x = (c(u, 2) ^ c(u, 13) ^ c(u, 22)) + ((u & l[1]) ^ (u & l[2]) ^ (l[1] & l[2]));
      l = [w + x | 0].concat(l);
      l[4] = l[4] + w | 0;
    }
    for (d = 0; d < 8; d++) l[d] = l[d] + r[d] | 0;
  }
  for (d = 0; d < 8; d++) {
    for (e = 3; e + 1; e--) {
      const y = (l[d] >> (8 * e)) & 255;
      i += (y < 16 ? 0 : '') + y.toString(16);
    }
  }
  return i;
};
function setCookie(domain, key, value, options = {}) {
	const expires = options.expires || 730;
	const date = new Date();
	date.setTime(date.getTime() + expires * 24 * 60 * 60 * 1000);
	const expiresString = `expires=${date.toUTCString()}`;

	const cookie = `${key}=${value}; ${expiresString}; path=/ ; domain=.${domain};`;
	return cookie;
  }

 export const getVisitorStatus = ({
	request,
	expiryDays = 30,
	cookieName = 's_nr',
  domain,
	// domain = `.${(new URL(window.location.origin)).hostname}`,
  }) => {
  const url = new URL(request.url);
	const currentTime = Date.now();

  const cookieHeader = request.headers.get("Cookie") || ""
  const cookies = {}

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.trim().split("=")
    if (parts.length >= 2) {
      const key = parts[0].trim()
      const value = parts.slice(1).join("=").trim()
      cookies[key] = value
    }
  })
	const cookieValue = cookies[cookieName];
	let visitorStatus;
	let cookie;

	// const cookieValue = getCookie(cookieName) || '';
	const cookieAttributes = { expires: new Date(currentTime + expiryDays * 24 * 60 * 60 * 1000) };

	if (domain) {
	  cookieAttributes.domain = domain;
	}

	if (!cookieValue) {
	  cookie = setCookie(domain, cookieName, `${currentTime}-New`, cookieAttributes);
	  visitorStatus = 'New';
	}

	const [storedTime, storedState] = cookieValue.split('-').map((value) => value.trim());

	if (currentTime - storedTime < 30 * 60 * 1000 && storedState === 'New') {
		cookie = setCookie(domain, cookieName, `${currentTime}-New`, cookieAttributes);
		visitorStatus = 'New';
	}

	cookie = setCookie(domain, cookieName, `${currentTime}-Repeat`, cookieAttributes);
	visitorStatus = 'Repeat';

	return {
		visitorStatus,
		cookie,
	};
  };

export function getEntitlementCreativeCloud(profile, scope) {
	if (
	  scope
	  && scope.indexOf('creative_cloud') !== -1
	  && profile
	  && profile.serviceAccounts
	) {
	  const serviceAccount = profile.serviceAccounts.find(
		(sa) => sa.serviceCode === 'creative_cloud',
	  );

	  if (!serviceAccount) {
		return 'notEntitled';
	  }

	  if (serviceAccount.serviceLevel === 'CS_LVL_2') {
		return 'paid';
	  } if (serviceAccount.serviceLevel === 'CS_LVL_1') {
		return 'free';
	  }
	  return 'notEntitled';
	}
	return 'notEntitled';
  }

 export function getEntitlementStatusCreativeCloud(profile, scope) {
	if (
	  scope
	  && scope.indexOf('creative_cloud') !== -1
	  && profile
	  && profile.serviceAccounts
	) {
	  const serviceAccount = profile.serviceAccounts.find(
		(sa) => sa.serviceCode === 'creative_cloud',
	  );
	  return serviceAccount?.serviceStatus || 'none';
	}
	return 'none';
  }
