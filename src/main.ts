import { createResponse } from 'create-response';
import { httpRequest } from 'http-request';
import { getPersonalizationData, getVisitorStatus } from "./target/target";
import { AuthState } from './authenticate/authenticate';
import { rewrite } from './rewriter';

const PROD_COOKIE_DOMAIN = '.adobe.com';

export async function responseProvider(request) {
  try {
  const urlString = `${request.scheme}://${request.host}${request.url}`;

  const cookie = getVisitorStatus({ request, domain: PROD_COOKIE_DOMAIN });
  const pageResponse = await httpRequest(urlString);
  const headers = {
      ...request.getHeaders(),
      "Expires": "0",
      "Cache-Control": "max-age=0, no-store, no-cache",
      "Set-Cookie": cookie,
      "Pragma": "no-cache",
  };
  const response = createResponse(pageResponse.status, headers, await personalize(request, pageResponse.body));
  return response;
  } catch (e) {
    return createResponse(500, {}, e);
  }
};

const personalize = async (request, responseBodyStream) => {
  const authState: AuthState = {
    type: "LoggedOut",
    data: {
      authState: 'loggedOut',
      returningStatus: 'New',
    },
  };
	const persStart = performance.now();
  const personalizationData = await getPersonalizationData(request, authState);
  const persEnd = performance.now();
	console.log(`Getting and Parsing Personalization Data Took ${persEnd - persStart}ms`);
	console.log("Rewriting HTML");
	return rewrite(responseBodyStream, personalizationData);
};
