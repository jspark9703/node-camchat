import { UserService } from './UserService';
import { LoginDto } from '../dto/auth/LoginDto';
import { TokenResponseDto } from '../dto/auth/TokenResponseDto';
import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.config';
import { User } from '../entities/User';

export interface JwtPayload {
  userId: string;
  email: string;
}

export class AuthService {
  constructor(private userService: UserService) {}

  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    // 사용자 인증
    const user = await this.userService.validatePassword(
      loginDto.email,
      loginDto.password
    );

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // JWT 토큰 생성
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    } as SignOptions);

    // 사용자 정보 가져오기
    const userResponse = await this.userService.getUserById(user.id);
    if (!userResponse) {
      throw new Error('User not found');
    }

    return {
      accessToken,
      user: {
        id: userResponse.id,
        email: userResponse.email,
        name: userResponse.name,
      },
    };
  }

  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
}

