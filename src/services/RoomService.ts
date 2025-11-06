import { RoomRepository } from '../repositories/RoomRepository';
import { UserRoomMapRepository } from '../repositories/UserRoomMapRepository';
import { CreateRoomDto } from '../dto/room/CreateRoomDto';
import { RoomResponseDto } from '../dto/room/RoomResponseDto';
import { Room } from '../entities/Room';

export class RoomService {
  constructor(
    private roomRepository: RoomRepository,
    private userRoomMapRepository: UserRoomMapRepository
  ) {}

  async createRoom(createRoomDto: CreateRoomDto): Promise<RoomResponseDto> {
    const room = await this.roomRepository.create(createRoomDto);
    return this.toResponseDto(room);
  }

  async getRoomById(id: string): Promise<RoomResponseDto | null> {
    const room = await this.roomRepository.findById(id);
    return room ? this.toResponseDto(room) : null;
  }

  async getAllRooms(): Promise<RoomResponseDto[]> {
    const rooms = await this.roomRepository.findAll();
    return rooms.map(room => this.toResponseDto(room));
  }

  async joinRoom(userId: string, roomId: string): Promise<void> {
    const existingMap = await this.userRoomMapRepository.findByUserAndRoom(userId, roomId);
    if (existingMap) {
      throw new Error('User is already in this room');
    }

    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    await this.userRoomMapRepository.create({ userId, roomId });
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    const existingMap = await this.userRoomMapRepository.findByUserAndRoom(userId, roomId);
    if (!existingMap) {
      throw new Error('User is not in this room');
    }

    await this.userRoomMapRepository.delete(userId, roomId);
  }

  async getRoomsByUserId(userId: string): Promise<RoomResponseDto[]> {
    const maps = await this.userRoomMapRepository.findByUserId(userId);
    return maps.map(map => this.toResponseDto(map.room));
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.userRoomMapRepository.deleteByRoomId(roomId);
    await this.roomRepository.delete(roomId);
  }

  private toResponseDto(room: Room): RoomResponseDto {
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}

