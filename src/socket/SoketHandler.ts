import { Server, Socket } from 'socket.io';
import { registerWebRTCSignaling } from '../webRTC/webRTC';

export type RoomInfo = {
  name: string;
  creator: string;
  users: string[]; // 입장 순서 유지
};

export class SocketHandler {
  private readonly roomsByName: Map<string, RoomInfo> = new Map();

  constructor(private readonly io: Server) {}

  initialize(): void {
    const io = this.io;

      const emitRoomList = () => {
      const payload = Array.from(this.roomsByName.values()).map((r) => ({
        name: r.name,
        creator: r.creator,
          userCount: r.users.length,
      }));
      io.emit('room_list_update', payload);
    };

      const emitRoomUsers = (roomName: string) => {
        const info = this.roomsByName.get(roomName);
        if (!info) return;
        io.to(roomName).emit('room_users', { users: info.users.slice() });
      };

      const autoDeleteIfEmpty = (roomName: string) => {
        const info = this.roomsByName.get(roomName);
        if (!info) return;
        if (info.users.length === 0) {
          io.to(roomName).emit('room_deleted', { roomName });
          io.in(roomName).socketsLeave(roomName);
          this.roomsByName.delete(roomName);
          emitRoomList();
        }
      };

    io.on('connection', (socket: Socket) => {
      socket.data.username = null as string | null;
      socket.data.currentRoom = null as string | null;

      socket.on('set_user', (username: string) => {
        if (typeof username === 'string' && username.trim()) {
          socket.data.username = username.trim();
        }
      });

      socket.on('request_room_list', () => {
        const payload = Array.from(this.roomsByName.values()).map((r) => ({
          name: r.name,
          creator: r.creator,
          userCount: r.users.length,
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
        if (this.roomsByName.has(name)) {
          socket.emit('error', { message: '이미 존재하는 방입니다.' });
          return;
        }
        this.roomsByName.set(name, { name, creator: username, users: [] });
        socket.emit('room_created', { roomName: name });
        emitRoomList();
      });

      socket.on('join_room', (roomName: string) => {
        const username = socket.data.username as string | null;
        if (!username) {
          socket.emit('error', { message: '인증되지 않았습니다.' });
          return;
        }
        const info = this.roomsByName.get(roomName);
        if (!info) {
          socket.emit('error', { message: '존재하지 않는 방입니다.' });
          return;
        }
        if (socket.data.currentRoom && socket.data.currentRoom !== roomName) {
          const prev = this.roomsByName.get(socket.data.currentRoom);
          if (prev) {
            prev.users = prev.users.filter((u) => u !== username);
            socket.leave(socket.data.currentRoom);
            io.to(socket.data.currentRoom).emit('user_left', { username });
            emitRoomUsers(socket.data.currentRoom);
            autoDeleteIfEmpty(socket.data.currentRoom);
          }
        }
        socket.join(roomName);
        socket.data.currentRoom = roomName;
        if (!info.users.includes(username)) info.users.push(username);
        io.to(roomName).emit('user_joined', { username });
        emitRoomList();
        emitRoomUsers(roomName);
      });

      socket.on('leave_room', (roomName: string) => {
        const username = socket.data.username as string | null;
        if (!username) return;
        const info = this.roomsByName.get(roomName);
        if (!info) return;
        info.users = info.users.filter((u) => u !== username);
        socket.leave(roomName);
        if (socket.data.currentRoom === roomName) socket.data.currentRoom = null;
        io.to(roomName).emit('user_left', { username });
        emitRoomList();
        emitRoomUsers(roomName);
        autoDeleteIfEmpty(roomName);
      });

      socket.on('delete_room', (roomName: string) => {
        const username = socket.data.username as string | null;
        if (!username) return;
        const info = this.roomsByName.get(roomName);
        if (!info) return;
        if (info.creator !== username) {
          socket.emit('error', { message: '방 생성자만 삭제할 수 있습니다.' });
          return;
        }
        io.to(roomName).emit('room_deleted', { roomName });
        io.in(roomName).socketsLeave(roomName);
        this.roomsByName.delete(roomName);
        if (socket.data.currentRoom === roomName) socket.data.currentRoom = null;
        emitRoomList();
      });

      socket.on('send_message', (data: { message: string }) => {
        const username = socket.data.username as string | null;
        if (!username) return;
        const roomName = socket.data.currentRoom as string | null;
        if (!roomName) return;
        const message = data && (data as any).message ? String((data as any).message).slice(0, 500) : '';
        if (!message) return;
        io.to(roomName).emit('new_message', {
          username,
          message,
          timestamp: Date.now(),
        });
      });

      // ----- WebRTC signaling -----
      const findSocketInRoomByUsername = async (roomName: string, targetUsername: string): Promise<Socket | null> => {
        const room = io.sockets.adapter.rooms.get(roomName);
        if (!room) return null;
        for (const socketId of room) {
          const s = io.sockets.sockets.get(socketId);
          if (s && s.data && s.data.username === targetUsername) return s;
        }
        return null;
      };
      registerWebRTCSignaling(io, socket, findSocketInRoomByUsername);

      socket.on('disconnect', () => {
        const username = socket.data.username as string | null;
        if (!username) return;
        const current = socket.data.currentRoom as string | null;
        if (current) {
          const info = this.roomsByName.get(current);
          if (info) {
            info.users = info.users.filter((u) => u !== username);
            io.to(current).emit('user_left', { username });
            emitRoomList();
            emitRoomUsers(current);
            autoDeleteIfEmpty(current);
          }
        }
      });
    });
  }
}
