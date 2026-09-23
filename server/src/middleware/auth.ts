import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AppError } from './errorHandler.js';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  baseId: string | null;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const token = header.slice(7);
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = jwt.verify(token, secret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

/** Restrict route to one or more roles */
export function authorize(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions for this action', 403));
    }
    next();
  };
}

/**
 * Base-scoped access: Admin sees all; others only their assigned base.
 * Mutating ops for Logistics Officer are limited to purchases/transfers via route-level authorize.
 */
export function assertBaseAccess(user: AuthUser, baseId: string | undefined | null) {
  if (user.role === Role.ADMIN) return;
  if (!user.baseId) {
    throw new AppError('User is not assigned to a base', 403);
  }
  if (baseId && baseId !== user.baseId) {
    throw new AppError('Access denied for this base', 403);
  }
}

export function baseScopeFilter(user: AuthUser): { baseId?: string } {
  if (user.role === Role.ADMIN) return {};
  if (!user.baseId) throw new AppError('User is not assigned to a base', 403);
  return { baseId: user.baseId };
}

/** Normalize Express route params (string | string[]) to a single string. */
export function routeParam(
  value: string | string[] | undefined,
  name = 'id'
): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw new AppError(`Missing route parameter: ${name}`, 400);
  return resolved;
}
