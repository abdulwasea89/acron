// Cookie name constants shared by middleware (edge runtime) and server session
// helpers. Kept free of any `next/headers` import so middleware can use them.
export const ACCESS_COOKIE = "gym_access";
export const REFRESH_COOKIE = "gym_refresh";
export const ORG_COOKIE = "gym_org";
