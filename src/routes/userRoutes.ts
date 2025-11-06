import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { CreateUserDto } from '../dto/user/CreateUserDto';
import { SuccessResponseDto } from '../dto/common/SuccessResponseDto';

export function createUserRoutes(userService: UserService): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const createUserDto: CreateUserDto = req.body;
      const user = await userService.createUser(createUserDto);
      
      const response: SuccessResponseDto = {
        success: true,
        message: 'User created successfully',
        data: user,
      };
      
      res.status(201).json(response);
    } catch (error: any) {
      const response: SuccessResponseDto = {
        success: false,
        message: error.message || 'Failed to create user',
      };
      res.status(400).json(response);
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);
      
      if (!user) {
        const response: SuccessResponseDto = {
          success: false,
          message: 'User not found',
        };
        return res.status(404).json(response);
      }

      const response: SuccessResponseDto = {
        success: true,
        message: 'User retrieved successfully',
        data: user,
      };
      
      res.json(response);
    } catch (error: any) {
      const response: SuccessResponseDto = {
        success: false,
        message: error.message || 'Failed to retrieve user',
      };
      res.status(500).json(response);
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const users = await userService.getAllUsers();
      
      const response: SuccessResponseDto = {
        success: true,
        message: 'Users retrieved successfully',
        data: users,
      };
      
      res.json(response);
    } catch (error: any) {
      const response: SuccessResponseDto = {
        success: false,
        message: error.message || 'Failed to retrieve users',
      };
      res.status(500).json(response);
    }
  });

  return router;
}

