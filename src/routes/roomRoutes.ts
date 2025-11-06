import { Router, Request, Response } from 'express';
import { RoomService } from '../services/RoomService';
import { CreateRoomDto } from '../dto/room/CreateRoomDto';
import { SuccessResponseDto } from '../dto/common/SuccessResponseDto';

export function createRoomRoutes(roomService: RoomService): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const createRoomDto: CreateRoomDto = req.body;
      const room = await roomService.createRoom(createRoomDto);
      
      const response: SuccessResponseDto = {
        success: true,
        message: 'Room created successfully',
        data: room,
      };
      
      res.status(201).json(response);
    } catch (error: any) {
      const response: SuccessResponseDto = {
        success: false,
        message: error.message || 'Failed to create room',
      };
      res.status(400).json(response);
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const room = await roomService.getRoomById(id);
      
      if (!room) {
        const response: SuccessResponseDto = {
          success: false,
          message: 'Room not found',
        };
        return res.status(404).json(response);
      }

      const response: SuccessResponseDto = {
        success: true,
        message: 'Room retrieved successfully',
        data: room,
      };
      
      res.json(response);
    } catch (error: any) {
      const response: SuccessResponseDto = {
        success: false,
        message: error.message || 'Failed to retrieve room',
      };
      res.status(500).json(response);
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const rooms = await roomService.getAllRooms();
      
      const response: SuccessResponseDto = {
        success: true,
        message: 'Rooms retrieved successfully',
        data: rooms,
      };
      
      res.json(response);
    } catch (error: any) {
      const response: SuccessResponseDto = {
        success: false,
        message: error.message || 'Failed to retrieve rooms',
      };
      res.status(500).json(response);
    }
  });

  router.post('/:id/join', async (req: Request, res: Response) => {
    try {
      const { id: roomId } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        const response: SuccessResponseDto = {
          success: false,
          message: 'UserId is required',
        };
        return res.status(400).json(response);
      }

      await roomService.joinRoom(userId, roomId);
      
      const response: SuccessResponseDto = {
        success: true,
        message: 'User joined room successfully',
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      const response: SuccessResponseDto = {
        success: false,
        message: error.message || 'Failed to join room',
      };
      res.status(400).json(response);
    }
  });

  router.post('/:id/leave', async (req: Request, res: Response) => {
    try {
      const { id: roomId } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        const response: SuccessResponseDto = {
          success: false,
          message: 'UserId is required',
        };
        return res.status(400).json(response);
      }

      await roomService.leaveRoom(userId, roomId);
      
      const response: SuccessResponseDto = {
        success: true,
        message: 'User left room successfully',
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      const response: SuccessResponseDto = {
        success: false,
        message: error.message || 'Failed to leave room',
      };
      res.status(400).json(response);
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await roomService.deleteRoom(id);
      
      const response: SuccessResponseDto = {
        success: true,
        message: 'Room deleted successfully',
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      const response: SuccessResponseDto = {
        success: false,
        message: error.message || 'Failed to delete room',
      };
      res.status(400).json(response);
    }
  });

  return router;
}

