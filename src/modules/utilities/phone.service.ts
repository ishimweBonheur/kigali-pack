import { Injectable } from '@nestjs/common';

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string;
  country: string;
  nationalNumber: string;
}

export interface CarrierResult {
  carrier: 'MTN' | 'AIRTEL' | 'UNKNOWN';
  networkCode: string | null;
  isMobileMoneySupported: boolean;
}

@Injectable()
export class PhoneService {
  private readonly rwandaCountryCode = '250';

  normalize(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('250')) {
      return `+${digits}`;
    }
    if (digits.startsWith('0') && digits.length === 10) {
      return `+250${digits.slice(1)}`;
    }
    if (digits.length === 9) {
      return `+250${digits}`;
    }
    return raw.startsWith('+') ? raw : `+${digits}`;
  }

  validate(phone: string): PhoneValidationResult {
    const normalized = this.normalize(phone);
    const national = normalized.replace(/^\+250/, '');
    const isValid = /^[78]\d{8}$/.test(national);

    return {
      isValid,
      normalized: isValid ? normalized : phone,
      country: 'RW',
      nationalNumber: isValid ? national : national,
    };
  }

  detectCarrier(phone: string): CarrierResult {
    const { isValid, normalized } = this.validate(phone);
    if (!isValid) {
      return {
        carrier: 'UNKNOWN',
        networkCode: null,
        isMobileMoneySupported: false,
      };
    }

    const prefix = normalized.replace(/^\+250/, '').charAt(0);
    const secondDigit = normalized.replace(/^\+250/, '').charAt(1);

    if (prefix === '7' && (secondDigit === '8' || secondDigit === '9')) {
      return {
        carrier: 'MTN',
        networkCode: `2507${secondDigit}`,
        isMobileMoneySupported: true,
      };
    }

    if (prefix === '7' && (secondDigit === '2' || secondDigit === '3')) {
      return {
        carrier: 'AIRTEL',
        networkCode: `2507${secondDigit}`,
        isMobileMoneySupported: true,
      };
    }

    return {
      carrier: 'UNKNOWN',
      networkCode: null,
      isMobileMoneySupported: false,
    };
  }

  format(phone: string, style: 'E164' | 'INTERNATIONAL' | 'NATIONAL' = 'E164') {
    const { isValid, normalized } = this.validate(phone);
    if (!isValid) {
      return { formatted: phone, style, isValid: false };
    }

    const national = normalized.replace(/^\+250/, '');

    switch (style) {
      case 'NATIONAL':
        return {
          formatted: `0${national}`,
          style,
          isValid: true,
        };
      case 'INTERNATIONAL':
        return {
          formatted: `+${this.rwandaCountryCode} ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`,
          style,
          isValid: true,
        };
      default:
        return { formatted: normalized, style: 'E164', isValid: true };
    }
  }
}
