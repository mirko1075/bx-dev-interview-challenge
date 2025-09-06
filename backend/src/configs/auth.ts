import { registerAs } from '@nestjs/config';

export const auth = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET,
}));
