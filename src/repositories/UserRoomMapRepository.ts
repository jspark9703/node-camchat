import { Repository } from 'typeorm';
import { UserRoomMap } from '../entities/UserRoomMap';

export class UserRoomMapRepository {
  constructor(private repository: Repository<UserRoomMap>) {}

  async findByUserId(userId: string): Promise<UserRoomMap[]> {
    return this.repository.find({ 
      where: { userId },
      relations: ['room']
    });
  }

  async findByRoomId(roomId: string): Promise<UserRoomMap[]> {
    return this.repository.find({ 
      where: { roomId },
      relations: ['user']
    });
  }

  async findByUserAndRoom(userId: string, roomId: string): Promise<UserRoomMap | null> {
    return this.repository.findOne({ 
      where: { userId, roomId }
    });
  }

  async create(mapData: Partial<UserRoomMap>): Promise<UserRoomMap> {
    const map = this.repository.create(mapData);
    return this.repository.save(map);
  }

  async delete(userId: string, roomId: string): Promise<void> {
    await this.repository.delete({ userId, roomId });
  }

  async deleteByRoomId(roomId: string): Promise<void> {
    await this.repository.delete({ roomId });
  }
}

