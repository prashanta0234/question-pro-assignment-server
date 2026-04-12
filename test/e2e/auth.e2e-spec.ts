
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from '../helpers/app.helper';

describe('Auth (E2E)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Wait for fire-and-forget audit writes to land before wiping the table,
    // otherwise a slow async write from the previous test bleeds into the next.
    await new Promise((r) => setTimeout(r, 100));

    // Delete in FK dependency order: children before parents
    await dataSource.query('DELETE FROM order_items');
    await dataSource.query('DELETE FROM orders');
    await dataSource.query('DELETE FROM audit_logs');
    await dataSource.query('DELETE FROM users');
  });

  // ─── POST /api/v1/auth/register ────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('should return 201 with accessToken on successful registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'newuser@test.com', password: 'Secure@1234' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(typeof res.body.data.accessToken).toBe('string');
    });

    it('should return 409 CONFLICT when email is already registered', async () => {
      const payload = { email: 'dup@test.com', password: 'Secure@1234' };

      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(201);

      // Duplicate registration
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('CONFLICT');
      expect(res.body.message).toBe('Email already registered');
    });

    it('should return 400 VALIDATION_ERROR with invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'Secure@1234' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('should return 400 VALIDATION_ERROR when password is too short (< 8 chars)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'user@test.com', password: 'short' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR for extra (non-whitelisted) fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'user@test.com', password: 'Secure@1234', role: 'ADMIN' })
        .expect(400);

      // forbidNonWhitelisted: true — extra fields are rejected
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return JWT that decodes with correct sub and role', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'jwt@test.com', password: 'Secure@1234' })
        .expect(201);

      const token = res.body.data.accessToken as string;
      // Decode without verification to check payload structure
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

      expect(payload.sub).toBeDefined();
      expect(payload.email).toBe('jwt@test.com');
      expect(payload.role).toBe('USER'); // default role
      expect(payload.exp).toBeDefined();
    });

    it('should include requestId in error response', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);

      expect(res.body.requestId).toBeDefined();
    });

    it('should NOT store plain-text password in DB (bcrypt hash only)', async () => {
      const email = 'hashcheck@test.com';
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'Secure@1234' })
        .expect(201);

      const row = await dataSource.query(
        'SELECT password FROM users WHERE email = $1',
        [email],
      );
      expect(row[0].password).toMatch(/^\$2b\$12\$/); // bcrypt format
      expect(row[0].password).not.toBe('Secure@1234');
    });

    it('should write a USER_REGISTERED audit log entry', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'auditcheck@test.com', password: 'Secure@1234' })
        .expect(201);

      // Give async audit write time to complete
      await new Promise((r) => setTimeout(r, 50));

      const logs = await dataSource.query(
        "SELECT * FROM audit_logs WHERE action = 'USER_REGISTERED'",
      );
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('SUCCESS');
    });
  });

  // ─── POST /api/v1/auth/login ───────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    const creds = { email: 'login@test.com', password: 'Secure@1234' };

    beforeEach(async () => {
      // Seed a user for login tests
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(creds);
    });

    it('should return 200 with accessToken on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(creds)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should return 401 INVALID_CREDENTIALS with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: creds.email, password: 'WrongPassword@99' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 INVALID_CREDENTIALS for non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@test.com', password: 'Secure@1234' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_CREDENTIALS');
    });

    it('should NOT reveal whether email exists vs wrong password (same 401 response)', async () => {
      const [resNoUser, resBadPass] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'ghost@test.com', password: 'any' }),
        request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: creds.email, password: 'wrong' }),
      ]);

      // Both return same error structure
      expect(resNoUser.status).toBe(401);
      expect(resBadPass.status).toBe(401);
      expect(resNoUser.body.error).toBe(resBadPass.body.error);
    });

    it('should return 400 VALIDATION_ERROR with invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'x' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR when body is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return a JWT with correct user payload on login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(creds)
        .expect(200);

      const token = res.body.data.accessToken as string;
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

      expect(payload.email).toBe(creds.email);
      expect(payload.role).toBe('USER');
      expect(payload.sub).toBeDefined();
    });

    it('should write a USER_LOGIN audit log on successful login', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(creds)
        .expect(200);

      await new Promise((r) => setTimeout(r, 50));

      const logs = await dataSource.query(
        "SELECT * FROM audit_logs WHERE action = 'USER_LOGIN' AND status = 'SUCCESS'",
      );
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('should write a USER_LOGIN_FAILED audit log on failed login', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: creds.email, password: 'WrongPass@99' })
        .expect(401);

      await new Promise((r) => setTimeout(r, 50));

      const logs = await dataSource.query(
        "SELECT * FROM audit_logs WHERE action = 'USER_LOGIN_FAILED' AND status = 'FAILURE'",
      );
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('should NOT store password in audit log afterData', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: creds.email, password: 'WrongPass@99' })
        .expect(401);

      await new Promise((r) => setTimeout(r, 50));

      const logs = await dataSource.query(
        "SELECT after_data FROM audit_logs WHERE action = 'USER_LOGIN_FAILED'",
      );
      for (const log of logs) {
        if (log.after_data) {
          expect(log.after_data).not.toHaveProperty('password');
        }
      }
    });
  });

  // ─── Protected routes ──────────────────────────────────────────────────────

  describe('Protected route access', () => {
    it('should return 401 when accessing a protected route without a token', async () => {
      // Any route that is not @Public()
      const res = await request(app.getHttpServer())
        .get('/api/v1/groceries')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 401 when token is malformed', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/groceries')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 401 when Authorization header is missing Bearer prefix', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/groceries')
        .set('Authorization', 'Token sometoken')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should allow access to protected route with valid JWT', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'protected@test.com', password: 'Secure@1234' });

      const token = body.data.accessToken as string;

      // GET /groceries is a protected route (returns 200 with valid token)
      const res = await request(app.getHttpServer())
        .get('/api/v1/groceries')
        .set('Authorization', `Bearer ${token}`);

      // Route exists and is accessible (may be 200 or 404 but NOT 401)
      expect(res.status).not.toBe(401);
    });
  });
});
