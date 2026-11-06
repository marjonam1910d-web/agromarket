// Test muhiti: alohida test bazasi. TEST_DATABASE_URL berilmasa — lokal agromarket_test.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://agromarket:agromarket@localhost:5432/agromarket_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789-0123456789-abcdef';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789-0123456789-abcdef';
process.env.OTP_SECRET ??= 'test-otp-secret-0123456789-0123456789-abcdefghij';
process.env.OTP_DEV_ECHO = 'true';
process.env.PAYMENT_SANDBOX = 'true';
process.env.REDIS_URL = '';
process.env.UPLOAD_DIR = './uploads-test';
process.env.API_PUBLIC_URL = 'http://localhost:4000';
process.env.PAYME_MERCHANT_ID = 'test-merchant';
process.env.PAYME_KEY = 'test-payme-key';
process.env.CLICK_SERVICE_ID = '111';
process.env.CLICK_MERCHANT_ID = '222';
process.env.CLICK_SECRET_KEY = 'click-secret';
