import 'reflect-metadata';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';

// Authenticated self-service change-password: the logged-in user changes their
// OWN password, re-verifying the current one first. userId comes from the guard
// (never the body); no cross-user surface. Reuses the module's bcrypt hashing.
describe('AuthService.changePassword', () => {
  const USER_ID = 'u1';
  const OLD_PASSWORD = 'OldP@ss1';
  const NEW_PASSWORD = 'NewP@ss2';

  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let service: AuthService;
  let storedHash: string;

  beforeEach(async () => {
    // SALT_ROUNDS = 12, matching the service's own hashing.
    storedHash = await bcrypt.hash(OLD_PASSWORD, 12);
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: USER_ID,
          email: 'user@example.com',
          password: storedHash,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('happy path: valid current + new → success; stored hash changes; new authenticates, old does not', async () => {
    const result = await service.changePassword(USER_ID, {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(result).toEqual({
      success: true,
      message: 'Password changed successfully',
    });
    // Response carries no password/hash material.
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('hash');

    // Scoped to the authenticated user's own id (from the guard, not the body).
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
    });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const updateArg = prisma.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: USER_ID });

    const newHash = updateArg.data.password as string;
    expect(newHash).not.toBe(storedHash); // the stored hash CHANGED
    expect(await bcrypt.compare(NEW_PASSWORD, newHash)).toBe(true); // new works
    expect(await bcrypt.compare(OLD_PASSWORD, newHash)).toBe(false); // old does not
  });

  it('wrong current password → UnauthorizedException; hash UNCHANGED (no write)', async () => {
    await expect(
      service.changePassword(USER_ID, {
        currentPassword: 'WrongP@ss9',
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('newPassword === currentPassword → BadRequestException; no DB read or write', async () => {
    await expect(
      service.changePassword(USER_ID, {
        currentPassword: OLD_PASSWORD,
        newPassword: OLD_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Rejected up front, before touching the user row.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('authenticated user no longer exists → UnauthorizedException; no write', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword(USER_ID, {
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

// The newPassword policy is enforced by the DTO (same rule as registration:
// min 6, at least one letter and one number). currentPassword must be non-empty.
describe('ChangePasswordDto validation', () => {
  async function errorsFor(obj: Record<string, unknown>) {
    return validate(plainToInstance(ChangePasswordDto, obj));
  }

  it('accepts a valid current + policy-compliant new password', async () => {
    const errors = await errorsFor({
      currentPassword: 'OldP@ss1',
      newPassword: 'NewP@ss2',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a new password that is too short (fails MinLength)', async () => {
    const errors = await errorsFor({
      currentPassword: 'OldP@ss1',
      newPassword: 'a1',
    });
    const newPwError = errors.find((e) => e.property === 'newPassword');
    expect(newPwError).toBeDefined();
  });

  it('rejects a new password with no digit (fails complexity)', async () => {
    const errors = await errorsFor({
      currentPassword: 'OldP@ss1',
      newPassword: 'onlyletters',
    });
    const newPwError = errors.find((e) => e.property === 'newPassword');
    expect(newPwError).toBeDefined();
    expect(newPwError?.constraints).toHaveProperty('matches');
  });

  it('rejects an empty current password', async () => {
    const errors = await errorsFor({
      currentPassword: '',
      newPassword: 'NewP@ss2',
    });
    const currentPwError = errors.find((e) => e.property === 'currentPassword');
    expect(currentPwError).toBeDefined();
  });
});

// Unauthenticated requests never reach the service — the route is behind the
// same JwtAuthGuard the other protected endpoints use.
describe('POST /auth/change-password — guard protection', () => {
  it('is protected by JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AuthController.prototype.changePassword,
    ) as unknown[];
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
  });
});
