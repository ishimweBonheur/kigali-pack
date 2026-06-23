import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from './http-exception.filter';

describe('GlobalHttpExceptionFilter', () => {
  const filter = new GlobalHttpExceptionFilter();

  const createHost = (requestId = 'req-123') => {
    const json = jest.fn();
    const setHeader = jest.fn();
    const response = {
      status: jest.fn().mockReturnValue({ json, setHeader }),
      setHeader,
    };

    const request = {
      method: 'GET',
      url: '/v1/test',
      originalUrl: '/v1/test',
      headers: { 'x-request-id': requestId },
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    return { host, json, setHeader, response };
  };

  it('returns unified error envelope for HttpException', () => {
    const { host, json, setHeader } = createHost();

    filter.catch(
      new HttpException('Not allowed', HttpStatus.FORBIDDEN),
      host,
    );

    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'req-123');
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not allowed',
      },
    });
  });

  it('maps validation arrays to VALIDATION_ERROR', () => {
    const { host, json } = createHost();

    filter.catch(
      new HttpException(
        { message: ['email must be an email'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'email must be an email',
      },
    });
  });

  it('never exposes raw Error message for unknown exceptions', () => {
    const { host, json } = createHost();

    filter.catch(new Error('database password leaked'), host);

    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
});
