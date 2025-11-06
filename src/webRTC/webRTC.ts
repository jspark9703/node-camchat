import { Server, Socket } from 'socket.io';

export function registerWebRTCSignaling(
  io: Server,
  socket: Socket,
  findSocketInRoomByUsername: (roomName: string, targetUsername: string) => Promise<Socket | null>
) {
  socket.on('webrtc_join', async () => {
    const username = socket.data.username as string | null;
    const roomName = socket.data.currentRoom as string | null;
    if (!username || !roomName) return;
    socket.to(roomName).emit('webrtc_peer_joined', { username });
  });

  socket.on('webrtc_offer', async ({ to, sdp }) => {
    const from = socket.data.username as string | null;
    const roomName = socket.data.currentRoom as string | null;
    if (!from || !roomName || !to || !sdp) return;
    const target = await findSocketInRoomByUsername(roomName, String(to));
    if (target) target.emit('webrtc_offer', { from, sdp });
  });

  socket.on('webrtc_answer', async ({ to, sdp }) => {
    const from = socket.data.username as string | null;
    const roomName = socket.data.currentRoom as string | null;
    if (!from || !roomName || !to || !sdp) return;
    const target = await findSocketInRoomByUsername(roomName, String(to));
    if (target) target.emit('webrtc_answer', { from, sdp });
  });

  socket.on('webrtc_ice_candidate', async ({ to, candidate }) => {
    const from = socket.data.username as string | null;
    const roomName = socket.data.currentRoom as string | null;
    if (!from || !roomName || !to || !candidate) return;
    const target = await findSocketInRoomByUsername(roomName, String(to));
    if (target) target.emit('webrtc_ice_candidate', { from, candidate });
  });
}


