import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const registerInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().trim().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const roleSchema = z.enum(['owner', 'manager', 'operator', 'viewer']);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
});
export type User = z.infer<typeof userSchema>;

export const authResponseSchema = z.object({ token: z.string(), user: userSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;
