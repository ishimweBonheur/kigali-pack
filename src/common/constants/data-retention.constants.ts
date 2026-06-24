/**
 * V2 data retention policy — routes that MUST NOT persist request/response bodies.
 * Only metadata audit footprints are written to developer_api_logs.
 */
export const TRANSIENT_ROUTE_PREFIXES = [
  '/v1/compliance/rra/taxes',
  '/v1/compliance/rra/rssb',
  '/v1/compliance/rra/payroll-summary',
  '/v1/utilities/phone/validate',
  '/v1/utilities/phone/carrier',
  '/v1/utilities/phone/format',
] as const;

/**
 * Core state-changing objects that ARE persisted to PostgreSQL.
 */
export const PERSISTENT_STATE_ROUTES = [
  '/v1/sandbox/payments/charge',
  '/v1/organizations',
  '/v1/developer/webhooks',
] as const;

export function isTransientRoute(routePath: string): boolean {
  const normalized = routePath.split('?')[0];
  return TRANSIENT_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.endsWith(prefix),
  );
}
