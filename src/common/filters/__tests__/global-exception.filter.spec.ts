import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from '../global-exception.filter';

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
const mockGetRequest = jest.fn().mockReturnValue({
  url: '/api/v1/test',
  id: 'req-1',
  socket: { remoteAddress: '127.0.0.1' },
});

const mockHost = {
  switchToHttp: () => ({
    getResponse: mockGetResponse,
    getRequest: mockGetRequest,
  }),
} as unknown as ArgumentsHost;

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    jest.clearAllMocks();
  });

  it('should format NotFoundException with structured error response', () => {
    filter.catch(new NotFoundException({ error: 'NOT_FOUND', message: 'Item not found' }), mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        error: 'NOT_FOUND',
        message: 'Item not found',
        requestId: 'req-1',
      }),
    );
  });

  it('should format UnauthorizedException correctly', () => {
    filter.catch(
      new UnauthorizedException({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }),
      mockHost,
    );

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, statusCode: 401, error: 'INVALID_CREDENTIALS' }),
    );
  });

  it('should format ForbiddenException correctly', () => {
    filter.catch(new ForbiddenException({ error: 'FORBIDDEN', message: 'Insufficient permissions' }), mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, statusCode: 403, error: 'FORBIDDEN' }),
    );
  });

  it('should format BadRequestException with validation messages', () => {
    filter.catch(
      new BadRequestException({ error: 'VALIDATION_ERROR', message: ['email must be an email', 'password too short'] }),
      mockHost,
    );

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: ['email must be an email', 'password too short'],
      }),
    );
  });

  it('should return 500 INTERNAL_SERVER_ERROR for unhandled exceptions', () => {
    filter.catch(new Error('Something exploded'), mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
      }),
    );
  });

  it('should NOT expose stack trace in the response body', () => {
    filter.catch(new Error('Internal crash'), mockHost);

    const body = mockJson.mock.calls[0][0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('stack');
  });

  it('should include requestId in all error responses', () => {
    filter.catch(new BadRequestException('bad'), mockHost);
    expect(mockJson.mock.calls[0][0]).toHaveProperty('requestId', 'req-1');
  });

  it('should include path and timestamp in error response', () => {
    filter.catch(new NotFoundException('not found'), mockHost);

    const body = mockJson.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toHaveProperty('path', '/api/v1/test');
    expect(body).toHaveProperty('timestamp');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should always set success: false in error responses', () => {
    const exceptions = [
      new NotFoundException('nf'),
      new UnauthorizedException('ua'),
      new ForbiddenException('fb'),
      new BadRequestException('br'),
      new Error('generic'),
    ];

    for (const ex of exceptions) {
      jest.clearAllMocks();
      filter.catch(ex, mockHost);
      const body = mockJson.mock.calls[0][0] as Record<string, unknown>;
      expect(body.success).toBe(false);
    }
  });
});
