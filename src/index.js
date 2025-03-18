// Cloudflare Worker for Edge Personalization with HTMLRewriter
addEventListener("fetch", (event) => {
	console.log("Received request:", event.request.url);
	event.respondWith(handleRequest(event.request))
  })
  
  const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Cookie, Authorization",
	"Access-Control-Max-Age": "86400",
  }
  
  async function handleRequest(request) {
	try {
	  const url = new URL(request.url)
	  
	  if (request.method === "OPTIONS") {
		return handleOptions(request)
	  }
	  
	  if (shouldProcessRequest(url)) {
		return handleEdgePersonalization(request, url)
	  }
	  
	  return fetch(request)
	} catch (error) {
	  console.error("Error in main handler:", error)
	  return new Response(`Server Error: ${error.message}`, {
		status: 500,
		headers: corsHeaders,
	  })
	}
  }
  
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
	  
	  const contentType = originalResponse.headers.get("content-type") || ""
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
	  headers: request.headers,
	  redirect: "follow",
	})
	
	const response = await fetch(originRequest)
	
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
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
	  const r = (Math.random() * 16) | 0
	  const v = c === "x" ? r : (r & 0x3) | 0x8
	  return v.toString(16)
	})
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
	  
	  // Make the request to Adobe Target
	  const targetResp = await fetch(`${TARGET_API_URL}?dataStreamId=${DATA_STREAM_ID}&requestId=${generateUUIDv4()}`, {
		method: "POST",
		body: JSON.stringify(requestBody),
		headers: {
		  "Content-Type": "application/json",
		},
	  })
	  
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
		  "identityMap": identityMap,
		  "web": {
			"webPageDetails": {
			  "URL": url.href,
			  "siteSection": url.hostname,
			  "server": url.hostname,
			  "isErrorPage": false,
			  "isHomePage": url.pathname === "/",
			  "name": pageName,
			  "pageViews": {
				"value": 1
			  }
			},
			"webReferrer": {
			  "URL": request.headers.get("Referer") || ""
			}
		  },
		  "timestamp": new Date().toISOString(),
		  "eventType": "decisioning.propositionFetch",
		  "implementationDetails": {
			"name": "https://ns.adobe.com/experience/alloy/reactor",
			"version": "1.0",
			"environment": "serverapi"
		  }
		},
		"data": {
		  "__adobe": {
			"target": {
			  "is404": false,
			  "authState": "loggedOut",
			  "hitType": "propositionFetch",
			  "isMilo": true,
			  "adobeLocale": locale.ietf,
			  "hasGnav": true
			}
		  },
		  "_adobe_corpnew": {
			"digitalData": {
			  "page": {
				"pageInfo": {
				  "language": locale.ietf,
				  "pageName": pageName,
				  "processedPageName": pageName,
				  "location": {
					"href": url.href,
					"origin": url.origin,
					"protocol": url.protocol,
					"host": url.host,
					"hostname": url.hostname,
					"port": url.port,
					"pathname": url.pathname,
					"search": url.search,
					"hash": url.hash
				  },
				  "siteSection": url.hostname
				}
			  },
			  "diagnostic": {
				"franklin": {
				  "implementation": "milo"
				}
			  },
			  "previousPage": {
				"pageInfo": {
				  "pageName": prevPageName || pageName
				}
			  },
			  "primaryUser": {
				"primaryProfile": {
				  "profileInfo": {
					"authState": "loggedOut",
					"returningStatus": "Repeat",
					"entitlementCreativeCloud": "unknown",
					"entitlementStatusCreativeCloud": "unknown"
				  }
				}
			  },
			  "target": {
				"at_property_val": AT_PROPERTY_VAL
			  }
			}
		  },
		  "marketingtech": {
			"adobe": {
			  "alloy": {
				"approach": "martech-API",
				"edgeConfigIdLaunch": DATA_STREAM_ID,
				"edgeConfigId": DATA_STREAM_ID
			  }
			}
		  },
		  "web": {
			"webPageDetails": {
			  "URL": url.href,
			  "siteSection": url.hostname,
			  "server": url.hostname,
			  "isErrorPage": false,
			  "isHomePage": url.pathname === "/",
			  "name": pageName,
			  "pageViews": {
				"value": 1
			  }
			}
		  },
		  "eventType": "decisioning.propositionFetch"
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
			`web://${url.hostname}${url.pathname}`
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
	  
	  const newHeaders = new Headers(transformedResponse.headers)
	  Object.keys(corsHeaders).forEach(key => {
		newHeaders.set(key, corsHeaders[key])
	  })
	  newHeaders.set("x-edge-personalized", "true")
	  
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
  