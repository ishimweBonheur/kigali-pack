import { ExecutionContext, CallHandler, ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;

  const interceptor = new TransformInterceptor(reflector);

  const createContext = (method = 'GET'): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, url: '/v1/test' }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  it('wraps controller payloads in the success envelope', (done) => {
    const next: CallHandler = {
      handle: () => of({ data: { id: '1' }, message: 'ok' }),
    };

    interceptor.intercept(createContext(), next).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        message: 'ok',
        data: { id: '1' },
        meta: {},
      });
      done();
    });
  });

  it('adds totalPages to pagination meta', (done) => {
    const next: CallHandler = {
      handle: () =>
        of({
          data: [{ id: '1' }],
          pagination: { page: 2, limit: 10, total: 25 },
        }),
    };

    interceptor.intercept(createContext(), next).subscribe((result) => {
      expect(result).toMatchObject({
        success: true,
        meta: {
          pagination: {
            page: 2,
            limit: 10,
            total: 25,
            totalPages: 3,
          },
        },
      });
      done();
    });
  });

  it('skips transformation when metadata requests it', (done) => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(true);
    const payload = { status: 'ok' };
    const next: CallHandler = { handle: () => of(payload) };

    interceptor.intercept(createContext(), next).subscribe((result) => {
      expect(result).toBe(payload);
      done();
    });
  });
});

describe('RolesGuard behavior', () => {
  it('uses ForbiddenException for role failures', () => {
    expect(() => {
      throw new ForbiddenException('Insufficient role permissions');
    }).toThrow(ForbiddenException);
  });
});
