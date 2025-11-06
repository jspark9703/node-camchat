import { Repository } from 'typeorm';
import { Room } from '../entities/Room';

export class RoomRepository {
  constructor(private repository: Repository<Room>) {}

  async findById(id: string): Promise<Room | null> {
    return this.repository.findOne({ where: { id } });
  }

  async create(roomData: Partial<Room>): Promise<Room> {
    const room = this.repository.create(roomData);
    return this.repository.save(room);
  }

  async update(id: string, roomData: Partial<Room>): Promise<Room | null> {
    await this.repository.update(id, roomData);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async findAll(): Promise<Room[]> {
    return this.repository.find();
  }
}

