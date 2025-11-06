import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { LoginDto } from '../dto/auth/LoginDto';
import { CreateUserDto } from '../dto/user/CreateUserDto';
import { createAuthMiddleware } from '../middlewares/authMiddleware';

export const createAuthRoutes = (
  authService: AuthService,
  userService: UserService
): Router => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  // 회원가입
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const createUserDto: CreateUserDto = req.body;
      const user = await userService.createUser(createUserDto);
      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Registration failed',
      });
    }
  });

  // 로그인
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const loginDto: LoginDto = req.body;
      const tokenResponse = await authService.login(loginDto);
      res.json({
        success: true,
        data: tokenResponse,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message || 'Login failed',
      });
    }
  });

  // 현재 사용자 정보 (JWT 토큰 검증)
  router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          authenticated: false,
        });
      }

      const user = await userService.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          authenticated: false,
        });
      }

      res.json({
        authenticated: true,
        user: user.email,
        userId: user.id,
        name: user.name,
      });
    } catch (error: any) {
      res.status(401).json({
        authenticated: false,
      });
    }
  });

  // 로그아웃 (클라이언트 측에서 토큰 삭제하므로 단순 응답만)
  router.post('/logout', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });

  // 이메일 중복 체크
  router.get('/dupl_check', async (req: Request, res: Response) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({
          ok: false,
          available: false,
          error: 'Email is required',
        });
      }

      const existingUser = await userService.getUserByEmail(email);
      res.json({
        ok: true,
        available: !existingUser,
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        available: false,
        error: error.message || 'Check failed',
      });
    }
  });

  return router;
};

