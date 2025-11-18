import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Room } from '../entities/Room';
import { UserRoomMap } from '../entities/UserRoomMap';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'a3',
  entities: [User, Room, UserRoomMap],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
});

