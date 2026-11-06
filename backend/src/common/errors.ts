export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const Errors = {
  badRequest: (message = "Noto'g'ri so'rov", details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details),
  validation: (details: unknown) => new AppError(422, 'VALIDATION_ERROR', "Ma'lumotlar noto'g'ri kiritildi", details),
  unauthorized: (message = 'Avval tizimga kiring') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = "Bu amal uchun ruxsat yo'q") => new AppError(403, 'FORBIDDEN', message),
  notFound: (what = 'Resurs') => new AppError(404, 'NOT_FOUND', `${what} topilmadi`),
  conflict: (code: string, message: string, details?: unknown) => new AppError(409, code, message, details),
  tooMany: (message = "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring") =>
    new AppError(429, 'TOO_MANY_REQUESTS', message),
};
