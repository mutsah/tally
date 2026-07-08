import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

// Profile self-service: the authenticated user reads / updates their own profile.
// userId comes from the guard (never the body); the password hash is never
// selected or returned.
describe('AuthService profile', () => {
  const USER_ID = 'u1';

  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let service: AuthService;

  const PROFILE = {
    id: USER_ID,
    email: 'user@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ ...PROFILE }),
        update: jest.fn(({ data }) =>
          Promise.resolve({ ...PROFILE, ...data }),
        ),
      },
    };
    service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  describe('getProfile', () => {
    it('returns the profile fields scoped to the session userId, no password', async () => {
      const result = await service.getProfile(USER_ID);
      expect(result).toEqual(PROFILE);
      expect(result).not.toHaveProperty('password');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER_ID } }),
      );
      // The select must exclude the hash.
      const arg = prisma.user.findUnique.mock.calls[0][0];
      expect(arg.select).not.toHaveProperty('password');
      expect(arg.select.email).toBe(true);
    });

    it('throws Unauthorized when the user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getProfile(USER_ID)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates the display name (scoped to userId) and returns no password', async () => {
      const result = await service.updateProfile(USER_ID, {
        firstName: 'Janet',
      });
      expect(result).toMatchObject({ firstName: 'Janet' });
      expect(result).not.toHaveProperty('password');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data: { firstName: 'Janet' },
        }),
      );
      const arg = prisma.user.update.mock.calls[0][0];
      expect(arg.select).not.toHaveProperty('password');
    });

    it('no-ops (no write) when nothing is provided', async () => {
      await service.updateProfile(USER_ID, {});
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalled();
    });
  });
});

// Unauthenticated requests never reach the service — both profile routes sit
// behind the same JwtAuthGuard as the rest of the authenticated surface.
describe('auth profile routes — guard protection', () => {
  it('GET /auth/me is protected by JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AuthController.prototype.getProfile,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('PATCH /auth/me is protected by JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AuthController.prototype.updateProfile,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });
});
