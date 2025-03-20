
// export default {
// 	async fetch(request) {
// 	  return new Response("Hello from Cloudflare Worker!", {
// 		headers: { "Content-Type": "text/plain" },
// 	  });
// 	},
//   };

// Cloudflare Worker for Edge Personalization with HTMLRewriter
addEventListener("fetch", (event) => {
	console.log("Received request:", event.request.url);
	event.respondWith(handleRequest(event.request));
  });
  
  const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
	"Access-Control-Max-Age": "86400",
  };
  
  async function handleRequest(request) {
	try {
	  const url = new URL(request.url);
  
	  if (request.method === "OPTIONS") {
		return handleOptions(request);
	  }
  
	  // Extract the path from the request URL
	  const path = url.pathname + url.search; // Include query parameters
	  console.log("Extracted path:", path);
  
	  // Construct the target URL
	  const targetUrl = url.origin + url.pathname;
	  console.log("Target URL:", targetUrl);
  
	  if (shouldProcessRequest(url)) {
		console.log("Handle EDGE PERS", handleEdgePersonalization(request, url))
		return handleEdgePersonalization(request, url);
	  }
  
	  // Fetch the original page from the target URL
	  const response = await fetch(targetUrl, {
		headers: {...request.headers, "Authorization": "token hlxtst_eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJjYy0tYWRvYmVjb20uYWVtLnBhZ2UiLCJzdWIiOiJtYWFncmF3YWxAYWRvYmUuY29tIiwiZXhwIjoxNzQyNTQ2NTM3fQ.NUlxOwxs5OxDFN_PAY31ZFM_zBFa6q36buniu4KtD73pYGB-9FwefySOWsiW7-Jz7CQmJXp2APKCa3Zea4PIB3MVa_APSrxIfMOLxj6ayszgyvwMe3TQ9f__HtN8Sqw8QzMmy25R9SxytDStAZ_firzYoVqKlRWr0W2Ojd3lEwRqJ9NOPYjZsYllQ8oR6RMgqE4vxcTcALJR5Ulcvl4g7sBDQVag5UDlLhIisPeuw01zShsPJMMr32Hga_5GQw63qUx0VRhq8juAy2IE9Hk-3Pn99wWY9yJM2OZ3Gol-RbzUZ26QHstrWlCdISs-Pspc__j0qHjCq6-Ol8Q6hBwevQ"}, // Forward original headers
	  });
	  console.log("Headers Response:", response);
  
	  // Return the response
	  return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	  });
	} catch (error) {
	  console.error("Error in main handler:", error);
	  return new Response(`Server Error: ${error.message}`, {
		status: 500,
		headers: corsHeaders,
	  });
	}
  }
  

//   // Cloudflare Worker for Edge Personalization with HTMLRewriter
// addEventListener("fetch", (event) => {
// 	//console.log("Received request:", event.request.url);
// 	event.respondWith(handleRequest(event.request))
//   })
  
//   const corsHeaders = {
// 	"Access-Control-Allow-Origin": "*",
// 	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
// 	"Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
// 	"Access-Control-Max-Age": "86400",
//   }
  
//   async function handleRequest(request) {
// 	try {
// 	  const url = new URL(request.url)
	  
// 	  if (request.method === "OPTIONS") {
// 		return handleOptions(request)
// 	  }
	  
// 	  if (shouldProcessRequest(url)) {
// 		return handleEdgePersonalization(request, url)
// 	  }
	  
// 	  return fetch(request)
// 	} catch (error) {
// 	  console.error("Error in main handler:", error)
// 	  return new Response(`Server Error: ${error.message}`, {
// 		status: 500,
// 		headers: corsHeaders,
// 	  })
// 	}
//   }
  
  function shouldProcessRequest(url) {
	return url.searchParams.has("edge-pers") || 
		   url.searchParams.get("target") === "on" || 
		   url.searchParams.get("hybrid-pers") === "on" ||
		   url.searchParams.get("hybrid_test") === "true" ||
		   url.searchParams.get("perf_test") === "true"
  }

  async function handleEdgePersonalization(request, url) {
	try {
	  const locale = determineLocale(request, url)
	  const env = determineEnvironment(url)
	  
	  const originalResponse = await fetchOriginalPage(request, url)
	  console.log("Original Response:", originalResponse);
	  
	  const contentType = originalResponse.headers.get("content-type") || ""
	  console.log("Content Type:", contentType);
	  if (!contentType.includes("text/html")) {
		return originalResponse
	  }
	  
	  const targetData = await fetchPersonalizationData({
		locale,
		env,
		request,
		url,
	  })
	  
	  const processedData = processPersonalizationData(targetData)
	  
	  return applyPersonalizationWithHTMLRewriter(originalResponse, processedData, url)
	} catch (error) {
	  console.error("Error in handleEdgePersonalization:", error)
	  
	  try {
		return await fetchOriginalPage(request, url)
	  } catch (fetchError) {
		console.error("Error fetching original page:", fetchError)
		return new Response("Error processing page", { 
		  status: 500,
		  headers: corsHeaders
		})
	  }
	}
  }

  async function fetchOriginalPage(request, url) {
	const originRequest = new Request(url.toString(), {
	  method: "GET",
	  headers: {...request.headers, "Authorization": "token hlxtst_eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJjYy0tYWRvYmVjb20uYWVtLnBhZ2UiLCJzdWIiOiJha2Fuc2hhYUBhZG9iZS5jb20iLCJleHAiOjE3NDI1MzQ5MDF9.AqM2BPNeWqG-nMXZxs4103AN0FCMD-V9maSu4scXL7tA_BNuvUif5DALq86xVOO8rMYY4Ei4UULLJy1FTZojO17Xr4KEJzGICkLzRa7cylzbVfnAeAsSh60MsP9RGUDXVvs2QkULXAOIEV5DwnoehlHqrPw7E4LiA9Xdtwa61Cvuc1ZdgS9tzc3zCFnoy_nwSwRJtKb4K473HBu1JxAxqxKawqPbwNF3c8Vt_6M0yuwzTd3zWkpXXGPmlJzgAt10CyLDemeD3ahVotvAgU5k3xhvIyonWdgS4lpjq0qsHZjJZjRkJhMNyI2HZyXqG5W7FfLl4BLUVimePGrdQfGpow"},
	  redirect: "follow",
	})
	
	const response = await fetch(originRequest)
	
	const newHeaders = new Headers(response.headers)
	Object.keys(corsHeaders).forEach(key => {
	  newHeaders.set(key, corsHeaders[key])
	})
	console.log("New Headers:", newHeaders);

	return new Response(response.body, {
	  status: response.status,
	  statusText: response.statusText,
	  headers: newHeaders
	})
  }
  
  function handleOptions(request) {
	return new Response(null, {
	  headers: corsHeaders
	})
  }
  
  function determineLocale(request, url) {
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
  
  function determineEnvironment(url) {

	const hostname = url.hostname.toLowerCase()
	if (
	  hostname.includes("stage") ||
	  hostname.includes("dev") ||
	  hostname.includes("test") ||
	  hostname.includes("localhost") ||
	  hostname.includes(".page") ||
	  hostname.includes(".live")
	) {
	  return "stage"
	}
	return "prod"
  }
  
  // Generate a UUID v4
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
  
  // Get cookies from request
  function getCookiesFromRequest(request) {
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
	
	return cookies
  }
  
  // Fetch personalization data from Adobe Target
  async function fetchPersonalizationData({ locale, env, request, url }) {
	try {
	  // Define constants based on environment
	  const DATA_STREAM_ID =
		env === "prod" ? "913eac4d-900b-45e8-9ee7-306216765cd2" : "e065836d-be57-47ef-b8d1-999e1657e8fd"
	  const TARGET_API_URL = `https://edge.adobedc.net/ee/v2/interact`
	  
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
	  })
	  console.log("Request payload:", JSON.stringify(requestBody, null, 2));
	  
	  // Make the request to Adobe Target
	  const targetResp = await fetch(`${TARGET_API_URL}?dataStreamId=${DATA_STREAM_ID}&requestId=${generateUUIDv4()}`, {
		method: "POST",
		body: JSON.stringify(requestBody),
	  })
	  console.log("Target Response",targetResp)
	  
	  if (!targetResp.ok) {
		throw new Error(`Failed to fetch interact call: ${targetResp.status} ${targetResp.statusText}`)
	  }
	  
	  return await targetResp.json()
	} catch (err) {
	  console.error("Error in fetchPersonalizationData:", err)
	  return {}
	}
  }
  
  // Create request payload for Adobe Target
  function createRequestPayload({ updatedContext, pageName, locale, env, url, request, DATA_STREAM_ID }) {
	const cookies = getCookiesFromRequest(request)
	const prevPageName = cookies['gpv']
	
	const AT_PROPERTY_VAL = getTargetPropertyBasedOnPageRegion(env, url.pathname)
	const REPORT_SUITES_ID = env === "prod" ? ["adbadobenonacdcprod"] : ["adbadobenacdcqa"]
	
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
		console.log("Identity Map", identityMap)
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
				"device": {
					"screenHeight": 1117,
					"screenWidth": 1728,
					"screenOrientation": "landscape"
				},
				"environment": {
					"type": "browser",
					"browserDetails": {
						"viewportWidth": 1728,
						"viewportHeight": 275
					}
				},
				"placeContext": {
					"localTime": "2025-03-14T06:11:32.623Z",
					"localTimezoneOffset": -330
				},
				"identityMap": {
					"ECID": [
						{
							"id": "89199314073073960203854048274649182064",
							"authenticatedState": "ambiguous",
							"primary": true
						}
					]
				},
				"web": {
					"webPageDetails": {
						"URL": "https://www.adobe.com/products/photoshop.html?hybrid-pers=off&target=on",
						"siteSection": "www.adobe.com",
						"server": "www.adobe.com",
						"isErrorPage": false,
						"isHomePage": false,
						"name": "adobe.com:products:photoshop",
						"pageViews": {
							"value": 0
						}
					},
					"webInteraction": {
						"name": "Martech-API",
						"type": "other",
						"linkClicks": {
							"value": 1
						}
					},
					"webReferrer": {
						"URL": ""
					}
				},
				"timestamp": "2025-03-14T06:11:32.624Z",
				"eventType": "decisioning.propositionFetch"
			},
			"data": {
				"__adobe": {
					"target": {
						"is404": false,
						"authState": "loggedOut",
						"hitType": "propositionFetch",
						"isMilo": true,
						"adobeLocale": "en-US",
						"hasGnav": true
					}
				},
				"_adobe_corpnew": {
					"digitalData": {
						"page": {
							"pageInfo": {
								"language": "en-US"
							}
						},
						"diagnostic": {
							"franklin": {
								"implementation": "milo"
							}
						},
						"previousPage": {
							"pageInfo": {
								"pageName": "adobe.com:products:photoshop"
							}
						},
						"primaryUser": {
							"primaryProfile": {
								"profileInfo": {
									"authState": "loggedOut",
									"returningStatus": "New"
								}
							}
						}
					}
				},
				"marketingtech": {
					"adobe": {
						"alloy": {
							"approach": "martech-API",
							"edgeConfigIdLaunch": "913eac4d-900b-45e8-9ee7-306216765cd2",
							"edgeConfigId": "913eac4d-900b-45e8-9ee7-306216765cd2"
						}
					}
				}
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
				"surfaces": [
					"web://www.adobe.com/products/photoshop.html"
				],
				"decisionScopes": [
					"__view__"
				]
			}
		},
		"meta": {
			"target": {
				"migration": true
			},
			"configOverrides": {
				"com_adobe_analytics": {
					"reportSuites": [
						"adbadobenonacdcprod",
						"adbadobeprototype"
					]
				},
				"com_adobe_target": {
					"propertyToken": "4db35ee5-63ad-59f6-cec6-82ef8863b22d"
				}
			},
			"state": {
				"domain": "adobe.com",
				"cookiesEnabled": true,
				"entries": [
					{
						"key": "kndctr_9E1005A551ED61CA0A490D45_AdobeOrg_cluster",
						"value": "jpn3"
					},
					{
						"key": "kndctr_9E1005A551ED61CA0A490D45_AdobeOrg_identity",
						"value": "CiY4OTE5OTMxNDA3MzA3Mzk2MDIwMzg1NDA0ODI3NDY0OTE4MjA2NFIRCOzxlJrZMhgBKgRKUE4zMALwAezxlJrZMg%3D%3D"
					}
				]
			}
		}
	}
  }
  
  // Get Target property based on page region
  function getTargetPropertyBasedOnPageRegion(env, pathname) {
	if (env !== "prod") return "bc8dfa27-29cc-625c-22ea-f7ccebfc6231"
	
	// EMEA & LATAM
	if (
	  pathname.search(
		/(\/africa\/|\/be_en\/|\/be_fr\/|\/be_nl\/|\/cis_en\/|\/cy_en\/|\/dk\/|\/de\/|\/ee\/|\/es\/|\/fr\/|\/gr_en\/|\/ie\/|\/il_en\/|\/it\/|\/lv\/|\/lu_de\/|\/lu_en\/|\/lu_fr\/|\/hu\/|\/mt\/|\/mena_en\/|\/nl\/|\/no\/|\/pl\/|\/pt\/|\/ro\/|\/ch_de\/|\/si\/|\/sk\/|\/ch_fr\/|\/fi\/|\/se\/|\/ch_it\/|\/tr\/|\/uk\/|\/at\/|\/cz\/|\/bg\/|\/ru\/|\/cis_ru\/|\/ua\/|\/il_he\/|\/mena_ar\/|\/lt\/|\/sa_en\/|\/ae_en\/|\/ae_ar\/|\/sa_ar\/|\/ng\/|\/za\/|\/qa_ar\/|\/eg_en\/|\/eg_ar\/|\/kw_ar\/|\/eg_ar\/|\/qa_en\/|\/kw_en\/|\/gr_el\/|\/br\/|\/cl\/|\/la\/|\/mx\/|\/co\/|\/ar\/|\/pe\/|\/gt\/|\/pr\/|\/ec\/|\/cr\/)/,
	  ) !== -1
	) {
	  return "488edf5f-3cbe-f410-0953-8c0c5c323772"
	}
  
	// APAC
	if (
	  pathname.search(
		/(\/au\/|\/hk_en\/|\/in\/|\/nz\/|\/sea\/|\/cn\/|\/hk_zh\/|\/tw\/|\/kr\/|\/sg\/|\/th_en\/|\/th_th\/|\/my_en\/|\/my_ms\/|\/ph_en\/|\/ph_fil\/|\/vn_en\/|\/vn_vi\/|\/in_hi\/|\/id_id\/|\/id_en\/)/,
	  ) !== -1
	) {
	  return "3de509ee-bbc7-58a3-0851-600d1c2e2918"
	}
  
	// JP
	if (pathname.indexOf("/jp/") !== -1) {
	  return "ba5bc9e8-8fb4-037a-12c8-682384720007"
	}
  
	return "4db35ee5-63ad-59f6-cec6-82ef8863b22d" // Default US property
  }
  
  // Process personalization data from Adobe Target response
  function processPersonalizationData(targetData) {
	// Extract personalization decisions
	const propositions = targetData?.handle?.find(d => d.type === "personalization:decisions")?.payload || []
	console.log("Propositions:", propositions);
	
	if (propositions.length === 0) {
	  console.log("No propositions found in Target response")
	  return { fragments: [], commands: [] }
	}
	
	console.log(`Found ${propositions.length} propositions`)
	
	// Process propositions to extract fragments and commands
	const fragments = []
	const commands = []
	
	propositions.forEach(proposition => {
	  proposition.items?.forEach(item => {
		if (item.data?.format === "application/json") {
		  const content = item.data.content
		  if (content?.manifestContent) {
			const experiences = content.manifestContent?.experiences?.data || content.manifestContent?.data || []
			
			experiences.forEach(experience => {
			  const action = experience.action
				?.toLowerCase()
				.replace("content", "")
				.replace("fragment", "")
				.replace("tosection", "")
			  
			  const selector = experience.selector
			  const variantNames = Object.keys(experience).filter(
				key => !["action", "selector", "pagefilter", "page filter", "page filter optional"].includes(
				  key.toLowerCase()
				)
			  )
			  
			  variantNames.forEach(variant => {
				if (!experience[variant] || experience[variant].toLowerCase() === "false") return
				
				if (getSelectorType(selector) === "fragment") {
				  fragments.push({
					selector: normalizePath(selector.split(" #_")[0]),
					val: normalizePath(experience[variant]),
					action,
					manifestId: content.manifestPath,
					targetManifestId: item.meta?.["activity.name"]
				  })
				} else if (action === "remove" || action === "replace" || action === "updateattribute") {
				  commands.push({
					action,
					selector,
					content: experience[variant],
					selectorType: getSelectorType(selector),
					manifestId: content.manifestPath,
					targetManifestId: item.meta?.["activity.name"]
				  })
				}
			  })
			})
		  }
		}
	  })
	})
	
	return { fragments, commands }
  }
  
  // Helper function to determine selector type
  function getSelectorType(selector) {
	const sel = selector?.toLowerCase().trim()
	if (sel?.startsWith("/") || sel?.startsWith("http")) return "fragment"
	return "other"
  }
  
  // Helper function to normalize paths
  function normalizePath(p, localize = true) {
	if (!p) return ""
	
	let path = p
	if (!path?.includes("/")) return path
	
	if (path.startsWith("http")) {
	  try {
		const url = new URL(path)
		path = url.pathname
	  } catch (e) {
		/* return path below */
	  }
	} else if (!path.startsWith("/")) {
	  path = `/${path}`
	}
	return path
  }
  
  // Fetch fragment content from a URL or path
  async function fetchFragmentContent(fragmentPath, url) {
	try {
	  // Determine if the fragment path is a full URL or a relative path
	  let fragmentUrl
	  if (fragmentPath.startsWith("http")) {
		fragmentUrl = fragmentPath
	  } else {
		// Use the origin from the current URL to build the fragment URL
		fragmentUrl = `${url.origin}${fragmentPath}`
	  }
	  
	  const response = await fetch(fragmentUrl, {
		headers: {
		  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
		}
	  })
	  console.log("Fragment Response:", response.text());
	  if (!response.ok) {
		throw new Error(`Failed to fetch fragment: ${response.status} ${response.statusText}`)
	  }
	  
	  return await response.text()
	} catch (error) {
	  console.error(`Error fetching fragment ${fragmentPath}:`, error)
	  return `<!-- Error loading fragment ${fragmentPath} -->`
	}
  }
  
  // Apply personalization to HTML using HTMLRewriter
  async function applyPersonalizationWithHTMLRewriter(response, { fragments, commands }, url) {
	try {
	  // Create a map of fragment paths to their content for faster lookup
	  const fragmentContentMap = new Map()
	  
	  // Prefetch all fragment content
	  await Promise.all(
		fragments.map(async (fragment) => {
		  try {
			const content = await fetchFragmentContent(fragment.val, url)
			console.log("Apply Pers HTML Rewriter:", content);
			fragmentContentMap.set(fragment.selector, content)
		  } catch (error) {
			console.error(`Error fetching fragment ${fragment.selector}:`, error)
			fragmentContentMap.set(fragment.selector, `<!-- Error loading fragment ${fragment.val} -->`)
		  }
		})
	  )
	  
	  // Create a new response with transformed HTML
	  let rewriter = new HTMLRewriter()
		// Add a meta tag to indicate the page was personalized at the edge
		.on("head", {
		  element(element) {
			element.append('<meta name="edge-personalized" content="true" />', { html: true })
			element.append(
			  `<script>window.edgePersonalizationApplied = true;</script>`,
			  { html: true }
			)
		  }
		})
	  
	  fragments.forEach((fragment) => {
		if (fragmentContentMap.has(fragment.selector)) {
		  const fragmentContent = fragmentContentMap.get(fragment.selector)
		  console.log("Fragment Content:", fragmentContent);
		  const startCommentSelector = `!-- fragment ${fragment.selector} start --`
		  
		  rewriter = rewriter.on(startCommentSelector, {
			comment(comment) {
			  comment.after(fragmentContent, { html: true })
			}
		  })
		}
	  })
	  
	  commands.forEach((command) => {
		if (command.selectorType !== "fragment") {
		  if (command.action === "replace") {
			rewriter = rewriter.on(`#${command.selector}`, {
			  element(element) {
				element.setInnerContent(command.content, { html: true })
			  }
			})
		  } else if (command.action === "remove") {
			rewriter = rewriter.on(`#${command.selector}`, {
			  element(element) {
				element.remove()
			  }
			})
		  } else if (command.action === "updateattribute") {
			try {
			  const attrData = JSON.parse(command.content)
			  rewriter = rewriter.on(`#${command.selector}`, {
				element(element) {
				  Object.entries(attrData).forEach(([attrName, attrValue]) => {
					element.setAttribute(attrName, attrValue)
				  })
				}
			  })
			} catch (e) {
			  console.error("Error parsing attribute data:", e)
			}
		  }
		}
	  })
	  
	  const transformedResponse = rewriter.transform(response)
	  console.log("Transformed Response:", transformedResponse);
	  
	  const newHeaders = new Headers(transformedResponse.headers)
	  console.log("New Headers:", newHeaders);
	  Object.keys(corsHeaders).forEach(key => {
		newHeaders.set(key, corsHeaders[key])
	  })
	  newHeaders.set("x-edge-personalized", "true")
	  console.log("New Headers:", newHeaders);
	  
	  return new Response(transformedResponse.body, {
		status: transformedResponse.status,
		statusText: transformedResponse.statusText,
		headers: newHeaders
	  })
	} catch (error) {
	  console.error("Error in applyPersonalizationWithHTMLRewriter:", error)
	  
	  const newHeaders = new Headers(response.headers)
	  Object.keys(corsHeaders).forEach(key => {
		newHeaders.set(key, corsHeaders[key])
	  })
	  
	  return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders
	  })
	}
  }
  