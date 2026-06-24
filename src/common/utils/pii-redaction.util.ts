const PII_FIELD_PATTERN =
  /^(nationalId|national_id|phone|phoneNumber|phone_number|email|firstName|first_name|lastName|last_name|grossSalary|gross_salary|salary|password|secret|token|authorization|ssn|nin)$/i;

const PHONE_PATTERN = /(\+?25?0?7[2389]\d{7}|\d{16})/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.\w+/g;

function maskScalar(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    if (EMAIL_PATTERN.test(value)) {
      return value.replace(EMAIL_PATTERN, '[REDACTED_EMAIL]');
    }
    if (PHONE_PATTERN.test(value)) {
      return value.replace(PHONE_PATTERN, '[REDACTED_PHONE]');
    }
    if (value.length > 64) {
      return `${value.slice(0, 4)}…[REDACTED]`;
    }
  }
  if (typeof value === 'number' && value > 999) {
    return '[REDACTED_NUMBER]';
  }
  return value;
}

export function redactPiiFromObject(
  input: unknown,
  depth = 0,
): unknown {
  if (input === null || input === undefined) {
    return input;
  }
  if (depth > 8) {
    return '[REDACTED_DEPTH]';
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactPiiFromObject(item, depth + 1));
  }
  if (typeof input !== 'object') {
    return maskScalar(input);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (PII_FIELD_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    if (value !== null && typeof value === 'object') {
      result[key] = redactPiiFromObject(value, depth + 1);
    } else {
      result[key] = maskScalar(value);
    }
  }
  return result;
}

export function createMaskedPayloadSnapshot(
  requestBody: unknown,
  responseBody: unknown,
  isTransient: boolean,
): { request: string; response: string } {
  if (isTransient) {
    return {
      request: '[TRANSIENT — raw input processed in RAM only, not persisted]',
      response: '[TRANSIENT — structural output returned, raw input discarded]',
    };
  }

  const maskedRequest = redactPiiFromObject(requestBody ?? {});
  const maskedResponse = redactPiiFromObject(responseBody ?? {});

  return {
    request: JSON.stringify(maskedRequest).slice(0, 2048),
    response: JSON.stringify(maskedResponse).slice(0, 2048),
  };
}
