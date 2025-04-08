type AuthState = LoggedIn | LoggedOut
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
    returningStatus: 'New' | 'Repeat',
    profileID: string | 'unknown',
    authID: string | 'unknown',
    fullProfileID: string || 'unknown',
    fullAuthID: string || 'unknown',
    AdobeIMSUserProfile,
};

type ServiceStatus = unknown;

type AdobeIMSUserProfile = {
  account_type: string | 'unknown',
  preferred_languages: profile?.preferred_languages || null,
  countryCode: profile?.countryCode || 'unknown',
  toua: profile?.toua || 'unknown',
  email: sha256(profile?.email?.toLowerCase() || 'unknown'),
  first_name: sha256(profile?.first_name?.toLowerCase() || 'unknown'),
  last_name: sha256(profile?.last_name?.toLowerCase() || 'unknown'),
  phoneNumber: sha256(profile?.phoneNumber?.replace('+', '') || 'unknown'),
  roles: profile?.roles || [],
  tags: profile?.tags || [],
};

type LoggedOutData = {
  authState: 'loggedOut',
  returningStatus: 'New' | 'Repeat';
}
