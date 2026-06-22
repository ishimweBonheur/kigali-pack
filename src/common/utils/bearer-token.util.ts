const JWT_PATTERN =
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

const API_KEY_PATTERN =
  /kp_(?:test|live|sandbox)_[A-Za-z0-9]+/;

/**
 * Normalizes Bearer credentials — handles common Swagger paste mistakes such as
 * copying the full login JSON instead of only accessToken.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const raw = authHeader.slice(7).trim();
  if (!raw) {
    return null;
  }

  const embeddedAccessToken = raw.match(
    /"accessToken"\s*:\s*"([^"]+)"/,
  )?.[1];
  if (embeddedAccessToken) {
    return embeddedAccessToken;
  }

  const jwtFromBody = raw.match(JWT_PATTERN)?.[0];
  if (jwtFromBody) {
    return jwtFromBody;
  }

  const apiKeyFromBody = raw.match(API_KEY_PATTERN)?.[0];
  if (apiKeyFromBody) {
    return apiKeyFromBody;
  }

  const beforeDelimiter = raw.split(/["',]/)[0]?.trim();
  return beforeDelimiter || null;
}

export function isDeveloperApiKey(token: string): boolean {
  return API_KEY_PATTERN.test(token);
}
