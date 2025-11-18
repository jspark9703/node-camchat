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
import { SocketHandler } from './src/socket/SoketHandler';
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

// Chat service will manage in-memory rooms and socket events

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

    // Initialize Chat Service (Socket.IO handlers)
    const chatService = new SocketHandler(io);
    chatService.initialize();

    const PORT = process.env.PORT || 20001;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error during database initialization:', error);
  });

export default app;

