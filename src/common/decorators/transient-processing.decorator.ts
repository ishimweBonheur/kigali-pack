import { SetMetadata } from '@nestjs/common';

export const TRANSIENT_PROCESSING_KEY = 'transient_processing';

/**
 * Marks an endpoint as a pure utility pipeline — inputs are processed in volatile
 * RAM and never written to PostgreSQL. Only metadata audit logs are retained.
 */
export const TransientProcessing = () =>
  SetMetadata(TRANSIENT_PROCESSING_KEY, true);
