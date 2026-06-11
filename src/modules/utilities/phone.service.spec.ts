import { PhoneService } from './phone.service';

describe('PhoneService', () => {
  let service: PhoneService;

  beforeEach(() => {
    service = new PhoneService();
  });

  it('should validate MTN numbers', () => {
    const result = service.validate('+250788123456');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('+250788123456');
  });

  it('should detect MTN carrier', () => {
    const result = service.detectCarrier('0788123456');
    expect(result.carrier).toBe('MTN');
    expect(result.isMobileMoneySupported).toBe(true);
  });

  it('should detect Airtel carrier', () => {
    const result = service.detectCarrier('+250722123456');
    expect(result.carrier).toBe('AIRTEL');
  });

  it('should format to national style', () => {
    const result = service.format('+250788123456', 'NATIONAL');
    expect(result.formatted).toBe('0788123456');
    expect(result.isValid).toBe(true);
  });
});
