import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';
import { Room } from './Room';

@Entity('user_room_maps')
export class UserRoomMap {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  roomId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'roomId' })
  room!: Room;

  @CreateDateColumn()
  joinedAt!: Date;
}

