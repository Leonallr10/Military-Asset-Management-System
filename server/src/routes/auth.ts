import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';

export const authRouter = Router();

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret';
const ACCESS_EXPIRES = '12h';

type AccessPayload = {
  id: string;
  email: string;
  role: Role;
  baseId: string | null;
  name: string;
};

const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');

function signAccessToken(payload: AccessPayload) {
  return jwt.sign(payload, JWT_SECRET(), { expiresIn: ACCESS_EXPIRES });
}

async function userResponse(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { base: true },
  });
  if (!user) throw new AppError('User not found', 404);

  const payload: AccessPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    baseId: user.baseId,
    name: user.name,
  };

  return {
    token: signAccessToken(payload),
    user: {
      ...payload,
      rank: user.rank,
      base: user.base
        ? { id: user.base.id, name: user.base.name, code: user.base.code }
        : null,
    },
  };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordRule,
  name: z.string().min(2).max(100),
  rank: z.string().max(50).optional(),
  role: z.enum(['BASE_COMMANDER', 'LOGISTICS_OFFICER']),
  baseId: z.string().min(1),
});

const changePasswordSchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordRule,
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: { base: true },
    });
    if (!user) throw new AppError('Invalid credentials', 401);

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) throw new AppError('Invalid credentials', 401);

    const payload: AccessPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      baseId: user.baseId,
      name: user.name,
    };
    const token = signAccessToken(payload);

    await writeAuditLog({
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: { email: user.email },
      user: payload,
      ipAddress: req.ip,
    });

    res.json({
      token,
      user: {
        ...payload,
        rank: user.rank,
        base: user.base
          ? { id: user.base.id, name: user.base.name, code: user.base.code }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('An account with this email already exists', 409);

    const base = await prisma.base.findUnique({ where: { id: body.baseId } });
    if (!base) throw new AppError('Selected base was not found', 400);

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: body.name.trim(),
        rank: body.rank?.trim() || null,
        role: body.role as Role,
        baseId: body.baseId,
      },
    });

    const session = await userResponse(user.id);

    await writeAuditLog({
      action: 'REGISTER',
      entityType: 'User',
      entityId: user.id,
      details: { email: user.email, role: user.role, baseId: user.baseId },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        baseId: user.baseId,
        name: user.name,
      },
      ipAddress: req.ip,
    });

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

/** Update password for a specific account using current + new password. */
authRouter.post('/change-password', async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const email = body.email.toLowerCase();

    if (body.currentPassword === body.newPassword) {
      throw new AppError('New password must be different from the current password');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid email or current password', 401);

    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) throw new AppError('Invalid email or current password', 401);

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await writeAuditLog({
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: user.id,
      details: { email: user.email },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        baseId: user.baseId,
        name: user.name,
      },
      ipAddress: req.ip,
    });

    const session = await userResponse(user.id);
    res.json({
      message: 'Password updated successfully',
      ...session,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { base: true },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      rank: user.rank,
      role: user.role,
      baseId: user.baseId,
      base: user.base
        ? { id: user.base.id, name: user.base.name, code: user.base.code }
        : null,
    });
  } catch (err) {
    next(err);
  }
});
