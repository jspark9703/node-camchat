import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

// Express Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export const createAuthMiddleware = (authService: AuthService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Authorization 헤더에서 토큰 추출
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
      }

      const token = authHeader.substring(7); // 'Bearer ' 제거

      // 토큰 검증
      const payload = authService.verifyToken(token);

      // 요청 객체에 사용자 정보 추가
      req.user = {
        userId: payload.userId,
        email: payload.email,
      };

      next();
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
  };
};

