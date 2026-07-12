export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new ApiError(400, code, message, details);
  }
  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }
  static forbidden(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }
  static notFound(message: string, code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }
  static conflict(code: string, message: string, details?: unknown) {
    return new ApiError(409, code, message, details);
  }
  static unprocessable(code: string, message: string, details?: unknown) {
    return new ApiError(422, code, message, details);
  }
}
