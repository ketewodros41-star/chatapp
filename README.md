WhatsApp-style Chat App (React + Node.js + Socket.io + MongoDB)

Project structure:
- backend: Node.js + Express + Socket.io + mongoose (stores messages)
- frontend: React app (socket.io-client)

How to run locally:

1) Backend:
   cd backend
   npm install
   # optionally set MONGO_URI to a running MongoDB instance
   npm start

2) Frontend:
   cd frontend
   npm install
   npm start

Notes:
- The project in this zip is ready to run locally. You need Node and (optionally) MongoDB installed.
- Default server port: 5000. Default React dev port: 3000.
