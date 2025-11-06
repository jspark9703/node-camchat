export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'js',
  expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as string,
};

