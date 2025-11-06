import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { AppDataSource } from './src/config/typeorm.config';
import { User } from './src/entities/User';
import { Room } from './src/entities/Room';
import { UserRoomMap } from './src/entities/UserRoomMap';
import { UserRepository } from './src/repositories/UserRepository';
import { RoomRepository } from './src/repositories/RoomRepository';
import { UserRoomMapRepository } from './src/repositories/UserRoomMapRepository';
import { UserService } from './src/services/UserService';
import { RoomService } from './src/services/RoomService';
import { AuthService } from './src/services/AuthService';
import { createUserRoutes } from './src/routes/userRoutes';
import { createRoomRoutes } from './src/routes/roomRoutes';
import { createAuthRoutes } from './src/routes/authRoutes';
import path from 'path';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

type RoomInfo = {
  name: string;
  creator: string;
  users: Set<string>; // usernames
};

const roomsByName: Map<string, RoomInfo> = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database connection
AppDataSource.initialize()
  .then(() => {
    console.log('Database connection initialized');

    // Initialize repositories
    const userRepository = new UserRepository(AppDataSource.getRepository(User));
    const roomRepository = new RoomRepository(AppDataSource.getRepository(Room));
    const userRoomMapRepository = new UserRoomMapRepository(
      AppDataSource.getRepository(UserRoomMap)
    );

    // Initialize services
    const userService = new UserService(userRepository);
    const roomService = new RoomService(roomRepository, userRoomMapRepository);
    const authService = new AuthService(userService);

    // Initialize routes
    app.use('/api/v1/auth', createAuthRoutes(authService, userService));
    app.use('/api/users', createUserRoutes(userService));
    app.use('/api/rooms', createRoomRoutes(roomService));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    io.on('connection', (socket) => {
      // username will be set after client emits 'set_user'
      socket.data.username = null as string | null;
      socket.data.currentRoom = null as string | null;

      const emitRoomList = () => {
        const payload = Array.from(roomsByName.values()).map((r) => ({
          name: r.name,
          creator: r.creator,
          userCount: r.users.size,
        }));
        io.emit('room_list_update', payload);
      };

      socket.on('set_user', (username: string) => {
        if (typeof username === 'string' && username.trim()) {
          socket.data.username = username.trim();
        }
      });

      socket.on('request_room_list', () => {
        const payload = Array.from(roomsByName.values()).map((r) => ({
          name: r.name,
          creator: r.creator,
          userCount: r.users.size,
        }));
        socket.emit('room_list_update', payload);
      });

      socket.on('create_room', (roomName: string) => {
        const username = socket.data.username as string | null;
        if (!username) {
          socket.emit('error', { message: '인증되지 않았습니다.' });
          return;
        }
        const name = (roomName || '').trim();
        if (!name) return;
        if (roomsByName.has(name)) {
          socket.emit('error', { message: '이미 존재하는 방입니다.' });
          return;
        }
        roomsByName.set(name, { name, creator: username, users: new Set() });
        socket.emit('room_created', { roomName: name });
        emitRoomList();
      });

      socket.on('join_room', (roomName: string) => {
        const username = socket.data.username as string | null;
        if (!username) {
          socket.emit('error', { message: '인증되지 않았습니다.' });
          return;
        }
        const info = roomsByName.get(roomName);
        if (!info) {
          socket.emit('error', { message: '존재하지 않는 방입니다.' });
          return;
        }
        if (socket.data.currentRoom && socket.data.currentRoom !== roomName) {
          // leave previous first
          const prev = roomsByName.get(socket.data.currentRoom);
          if (prev) {
            prev.users.delete(username);
            socket.leave(socket.data.currentRoom);
            io.to(socket.data.currentRoom).emit('user_left', { username });
          }
        }
        socket.join(roomName);
        socket.data.currentRoom = roomName;
        info.users.add(username);
        io.to(roomName).emit('user_joined', { username });
        emitRoomList();
      });

      socket.on('leave_room', (roomName: string) => {
        const username = socket.data.username as string | null;
        if (!username) return;
        const info = roomsByName.get(roomName);
        if (!info) return;
        info.users.delete(username);
        socket.leave(roomName);
        if (socket.data.currentRoom === roomName) socket.data.currentRoom = null;
        io.to(roomName).emit('user_left', { username });
        emitRoomList();
      });

      socket.on('delete_room', (roomName: string) => {
        const username = socket.data.username as string | null;
        if (!username) return;
        const info = roomsByName.get(roomName);
        if (!info) return;
        if (info.creator !== username) {
          socket.emit('error', { message: '방 생성자만 삭제할 수 있습니다.' });
          return;
        }
        // Notify and make everyone leave
        io.to(roomName).emit('room_deleted', { roomName });
        io.in(roomName).socketsLeave(roomName);
        roomsByName.delete(roomName);
        if (socket.data.currentRoom === roomName) socket.data.currentRoom = null;
        emitRoomList();
      });

      socket.on('send_message', (data: { message: string }) => {
        const username = socket.data.username as string | null;
        if (!username) return;
        const roomName = socket.data.currentRoom as string | null;
        if (!roomName) return;
        const message = (data && data.message) ? String(data.message).slice(0, 500) : '';
        if (!message) return;
        io.to(roomName).emit('new_message', {
          username,
          message,
          timestamp: Date.now(),
        });
      });

      socket.on('disconnect', () => {
        const username = socket.data.username as string | null;
        if (!username) return;
        const current = socket.data.currentRoom as string | null;
        if (current) {
          const info = roomsByName.get(current);
          if (info) {
            info.users.delete(username);
            io.to(current).emit('user_left', { username });
            emitRoomList();
          }
        }
      });
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error during database initialization:', error);
  });

export default app;

