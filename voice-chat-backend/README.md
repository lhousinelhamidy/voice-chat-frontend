# Voice Chat Backend - Free & Encrypted

Simple backend for voice chat using WebRTC and Socket.IO with encryption.

## Features
- ✅ **Free**: No paid services required
- ✅ **Encrypted**: XOR encryption for signaling data
- ✅ **Real-time**: WebSocket communication via Socket.IO
- ✅ **WebRTC Ready**: Supports peer-to-peer voice connections
- ✅ **Room System**: Multiple voice rooms support

## Installation

```bash
npm install
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Configuration

Edit `.env` file:
```
PORT=3001
ENCRYPTION_KEY=your-secret-key-here
```

## API Endpoints

- `GET /` - Health check

## Socket Events

### Client → Server
- `join-room` - Join a voice room
- `webrtc-offer` - Send WebRTC offer
- `webrtc-answer` - Send WebRTC answer
- `ice-candidate` - Send ICE candidate

### Server → Client
- `user-joined` - New user joined room
- `user-left` - User left room
- `room-users` - List of users in room
- `webrtc-offer` - Receive WebRTC offer
- `webrtc-answer` - Receive WebRTC answer
- `ice-candidate` - Receive ICE candidate

## How It Works

1. **Signaling**: Socket.IO handles the signaling between peers
2. **Encryption**: All signaling data is encrypted using XOR cipher
3. **Media**: WebRTC handles peer-to-peer audio streaming (no server bandwidth!)
4. **Rooms**: Users can join different rooms for private conversations

## Frontend Integration Example

```javascript
const socket = io('http://localhost:3001');

// Join room
socket.emit('join-room', { roomId: 'room1', username: 'John' });

// Setup WebRTC when receiving offer
socket.on('webrtc-offer', async ({ senderId, offer }) => {
  const decryptedOffer = JSON.parse(decrypt(offer));
  // Handle WebRTC offer...
});
```

## Notes

- The encryption is basic XOR for simplicity. For production, consider using AES or TLS
- WebRTC media is peer-to-peer, so it's already encrypted by DTLS
- For public deployment, use HTTPS/WSS for secure connections
- Free STUN servers are used for NAT traversal (no TURN server needed for most cases)
