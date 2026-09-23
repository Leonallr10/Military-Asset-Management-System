import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { base: true },
    });
    if (!user) throw new AppError('Invalid credentials', 401);

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) throw new AppError('Invalid credentials', 401);

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      baseId: user.baseId,
      name: user.name,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', {
      expiresIn: '12h',
    });

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
