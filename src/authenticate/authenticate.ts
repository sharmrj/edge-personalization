import { Env } from "..";

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
  AdobeIMSUserProfile: AdobeIMSUserProfile;
};

type ServiceStatus = unknown;

type AdobeIMSUserProfile = {
  account_type: string | 'unknown';
  preferred_languages: string[] | null;
  countryCode: string | 'unknown';
  toua: string | 'unknown';
  email: string | 'unknown';
  first_name: string | 'unknown';
  last_name: string | 'unknown';
  phoneNumber: string | 'unknown';
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
  const token = await getToken(aux_sid, env.CLIENT_SECRET);
  if (!token) return loggedOut;
  const profile = await getProfile(token, env.CLIENT_SECRET);
  if (!profile) return loggedOut;
  console.log(profile);
  return loggedOut;
};

const getToken = async (aux_sid: string, client_secret: string): Promise<string | null> => {
  try {
    const data = {
      grant_type: "aux_sid_exchange",
      client_id: "edge-p13n",
      client_secret,
      aux_sid,
      scope: "openid,AdobeID,additional_info.roles",
    };
    const response = await fetch(`${base}/ims/token/v3`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Token response not ok: ${response.status}`);
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
    if (!response.ok) throw new Error(`Token response not ok: ${response.status}`);
    const json = await response.json();
    return json;
  } catch (e) {
    console.error(e);
    return null;
  }
}
