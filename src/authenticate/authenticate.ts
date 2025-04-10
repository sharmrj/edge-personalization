import { Env } from "..";
import { getEntitlementCreativeCloud } from "../target/target";
import { getEntitlementStatusCreativeCloud } from "../target/target";
import { getVisitorStatus } from "../target/target";
import { sha256 } from "../target/target";

export type AuthState = LoggedIn | LoggedOut
type LoggedIn = {
  type: "LoggedIn",
  data: LoggedInData,
};

type LoggedOut = {
  type: "LoggedOut",
  data: LoggedOutData,
}

type LoggedInData = {
  authState: 'authenticated';
  entitlementCreativeCloud: 'notEntitled' | 'paid' | 'free';
  entitlementStatusCreativeCloud: 'none' | ServiceStatus;
  returningStatus: 'New' | 'Repeat';
  profileID: string | 'unknown';
  authID: string | 'unknown';
  fullProfileID: string | 'unknown';
  fullAuthID: string | 'unknown';
  adobeIMSUserProfile: AdobeIMSUserProfile;
};

type ServiceStatus = unknown;

type AdobeIMSUserProfile = {
  account_type: string | 'unknown';
  preferred_languages: string[] | null;
  countryCode: string | 'unknown';
  toua: string | 'unknown';
  email: string[] | 'unknown'; 
  first_name: string[] | 'unknown';
  last_name: string[] | 'unknown';
  phoneNumber: string[] | 'unknown';
  roles: string[];
  tags: string[];
};

type LoggedOutData = {
  authState: 'loggedOut',
  returningStatus: 'New' | 'Repeat';
}

const base = "https://adobeid-na1.services.adobe.com";

export const authenticate = async (request: Request, env: Env): Promise<AuthState> => {
  const cookie = request.headers.get("Cookie") ?? "";
  const aux_sid = cookie.split(';').map(x => x.trim().split('=')).find(([name]) => name === 'aux_sid')?.[1];
  const loggedOut: AuthState = { type: "LoggedOut", data: { authState: 'loggedOut', returningStatus: 'New' } };
  if (!aux_sid) return loggedOut;
  const tokenStart = performance.now();
  const token = await getToken(aux_sid, env.CLIENT_SECRET);
  const tokenEnd = performance.now();
  console.log(`Token request took: ${tokenEnd - tokenStart}ms`);
  if (!token) return loggedOut;
  const profileStart = performance.now();
  const profile = await getProfile(token, env.CLIENT_SECRET);
  const profileEnd = performance.now();
  const scope = "openid,AdobeID,additional_info.roles";
  console.log(`Profile request took: ${profileEnd - profileStart}ms`);
  if (!profile) return loggedOut;

  const adobeIMSUserProfile: AdobeIMSUserProfile = {
    account_type: profile?.account_type ?? "unknown",
    preferred_languages: profile?.preferred_languages ?? null,
    countryCode: profile?.countryCode ?? "unknown",
    toua: profile?.toua ?? "unknown",
    email: sha256(profile?.email.toLowerCase() ?? "unknown"),
    first_name: sha256(profile?.first_name.toLowerCase() ?? "unknown"),
    last_name: sha256(profile?.last_name.toLowerCase() ?? "unknown"),
    phoneNumber: sha256(profile?.phoneNumber?.replace('+', '') ?? "unknown"),
    roles: profile?.roles ?? [],
    tags: profile?.tags ?? [],
  }
  return {
    type: "LoggedIn",
    data: {
      authState: "authenticated",
      entitlementCreativeCloud: await getEntitlementCreativeCloud(profile, scope),
      entitlementStatusCreativeCloud: await getEntitlementStatusCreativeCloud(profile, scope),
      returningStatus: getVisitorStatus({ request }).visitorStatus || "Repeat", 
      profileID: profile?.userId?.split('@')[0] ?? 'unknown',
      authID: profile?.authId?.split('@')[0] ?? "unknown",
      fullProfileID: profile?.userId ?? "unknown",
      fullAuthID: profile?.authId ?? "unknown",
      adobeIMSUserProfile,
    }
  } as LoggedIn;
};

const getToken = async (aux_sid: string, client_secret: string): Promise<string | null> => {
  try {
    const response =await fetch('https://adobeid-na1.services.adobe.com/ims/token/v3', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=aux_sid_exchange&client_id=edge-p13n&client_secret=${client_secret}&aux_sid=${aux_sid}&scope=openid,AdobeID,additional_info.roles`,
    });
    if (!response.ok) throw new Error(`Token response not ok: ${JSON.stringify(response)}`);
    const json = await response.json();
    return json.access_token ?? null;
  } catch (e) {
    console.error(e);
    return null;
  };
};

const getProfile = async (token: string, client_secret: string): Promise< {[key: string]: string | null }, null> => {
  try {
    const response = await fetch(`${base}/ims/profile/v1`, {
      method: "GET",
      headers: {
        'X-IMS-ClientId': 'edge-p13n',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error(`Profile response not ok: ${JSON.stringify(response)}`);
    const json = await response.json();
    return json;
  } catch (e) {
    console.error(e);
    return null;
  }
}
