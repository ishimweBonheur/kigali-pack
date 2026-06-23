import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_ENDPOINT_KEY = 'deprecatedEndpoint';

export interface DeprecatedEndpointMeta {
  /** Replacement route or documentation link */
  link?: string;
  /** ISO-8601 sunset date (RFC 8594) */
  sunset?: string;
}

export const DeprecatedEndpoint = (meta: DeprecatedEndpointMeta = {}) =>
  SetMetadata(DEPRECATED_ENDPOINT_KEY, meta);
