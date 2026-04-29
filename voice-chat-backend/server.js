const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Simple encryption key (in production, use environment variables and proper key management)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-voice-chat-key-2024';

// XOR encryption function (simple but effective for basic obfuscation)
function encrypt(data) {
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    encrypted += String.fromCharCode(charCode);
  }
  return Buffer.from(encrypted).toString('base64');
}

function decrypt(encryptedData) {
  const decoded = Buffer.from(encryptedData, 'base64').toString('utf-8');
  let decrypted = '';
  for (let i = 0; i < decoded.length; i++) {
    const charCode = decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    decrypted += String.fromCharCode(charCode);
  }
  return decrypted;
}

// CORS configuration
app.use(cors({
  origin: '*', // Change this to your frontend URL in production
  methods: ['GET', 'POST']
}));

app.get('/', (req, res) => {
  res.json({ message: 'Voice Chat Backend is running!' });
});

// Socket.IO setup with encryption
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Store active rooms and users
const rooms = new Map();
const users = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a voice room
  socket.on('join-room', ({ roomId, username }) => {
    const encryptedRoomId = encrypt(roomId);
    const encryptedUsername = encrypt(username);
    
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    
    const user = { id: socket.id, username, roomId };
    users.set(socket.id, user);
    rooms.get(roomId).push(user);
    
    // Notify others in the room (with encrypted data)
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      username: encryptedUsername,
      roomId: encryptedRoomId
    });
    
    // Send current users to the new user
    const roomUsers = rooms.get(roomId).filter(u => u.id !== socket.id);
    socket.emit('room-users', {
      users: roomUsers.map(u => ({
        id: u.id,
        username: encrypt(u.username),
        roomId: encrypt(u.roomId)
      }))
    });
    
    console.log(`${username} joined room ${roomId}`);
  });

  // Handle WebRTC signaling (offer)
  socket.on('webrtc-offer', ({ targetUserId, offer, roomId }) => {
    const encryptedOffer = encrypt(JSON.stringify(offer));
    socket.to(targetUserId).emit('webrtc-offer', {
      senderId: socket.id,
      offer: encryptedOffer,
      roomId: encrypt(roomId)
    });
  });

  // Handle WebRTC signaling (answer)
  socket.on('webrtc-answer', ({ targetUserId, answer, roomId }) => {
    const encryptedAnswer = encrypt(JSON.stringify(answer));
    socket.to(targetUserId).emit('webrtc-answer', {
      senderId: socket.id,
      answer: encryptedAnswer,
      roomId: encrypt(roomId)
    });
  });

  // Handle ICE candidates
  socket.on('ice-candidate', ({ targetUserId, candidate, roomId }) => {
    const encryptedCandidate = encrypt(JSON.stringify(candidate));
    socket.to(targetUserId).emit('ice-candidate', {
      senderId: socket.id,
      candidate: encryptedCandidate,
      roomId: encrypt(roomId)
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room) {
        rooms.set(
          user.roomId,
          room.filter(u => u.id !== socket.id)
        );
        
        // Notify others in the room
        socket.to(user.roomId).emit('user-left', {
          userId: socket.id,
          username: encrypt(user.username),
          roomId: encrypt(user.roomId)
        });
        
        // Clean up empty rooms
        if (rooms.get(user.roomId).length === 0) {
          rooms.delete(user.roomId);
        }
      }
      users.delete(socket.id);
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Encryption enabled with key length: ${ENCRYPTION_KEY.length}`);
});
