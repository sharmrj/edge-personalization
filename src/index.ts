import { authenticate } from "./authenticate/authenticate";
import { rewrite } from "./rewriter";
import { getPersonalizationData } from "./target/target";
import { shouldPersonalize } from "./utils";
import { getVisitorStatus } from "./target/target";

export interface Env {
  CLIENT_SECRET: string;
};

export default {
	async fetch(request: Request, env: Env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const cacheKey = new Request(url.toString(), request);
		const cache = caches.default;
		const cookie = getVisitorStatus({ request, domain: url.hostname }).cookie;

		let response: Response = await cache.match(cacheKey);
		if (response) response = new Response(response.body, response);
		if (!response) {
			response = await fetch(request);
			response = new Response(response.body, response);
			// cache it for 24 hours
			response.headers.append("Cache-Control", "s-maxage-86400");
			// Non blocking
			// Also see: https://developers.cloudflare.com/workers/runtime-apis/context
			if (request.method === "GET")
				ctx.waitUntil(cache.put(cacheKey, response.clone()));
		}
		// we're not caching anything on akamai right now,
		// but we should only not cache personalized pages
		// in the production version
		response.headers.delete("Cache-Control");
		response.headers.set("Expires", "0");
		response.headers.set("Cache-Control", "max-age=0, no-store, no-cache");
		response.headers.set('Set-Cookie', cookie);
		// Pragma is deprecated, but the akamai documentation still
		// mentions it: https://techdocs.akamai.com/property-mgr/docs/caching-2#no-store
		response.headers.set("Pragma", "no-cache");
		if (shouldPersonalize(request)) return personalize(request, env, response);
		return response;
	}
}

async function personalize(request: Request, env: Env, response: Response): Promise<Response> {
	try {
    const authState = await authenticate(request, env);
		const persStart = performance.now();
		const personalizationData = await getPersonalizationData(request, authState);
		const persEnd = performance.now();
		console.log(`Getting and Parsing Personalization Data Took ${persEnd - persStart}ms`);
		console.log("Rewriting HTML");
		return rewrite(response, personalizationData);
	} catch (e) {
		console.error(e);
		return response;
	}
}
