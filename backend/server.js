const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

// ----- Config -----
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/whatsapp_clone";
const PORT = process.env.PORT || 5000;

// ----- Mongoose models -----
const messageSchema = new mongoose.Schema({
  from: String,
  to: String, // username or room/channel name
  mode: {
    type: String,
    enum: ["private", "group", "channel"],
    default: "private",
  },
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", messageSchema);

// ----- App -----
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
});

// In-memory maps (also persisted messages stored in MongoDB)
let users = {}; // socket.id -> username
let userSockets = {}; // username -> socket.id
let groups = {}; // groupName -> [usernames]
let channels = {}; // channelName -> [usernames]

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("register", async (username) => {
    users[socket.id] = username;
    userSockets[username] = socket.id;
    io.emit("onlineUsers", Object.values(users));
    // send initial channel list and groups (names)
    socket.emit("channelList", Object.keys(channels));
    socket.emit("groupList", Object.keys(groups));
    // load recent private messages for this user (optional - last 50)
    const recent = await Message.find({
      $or: [{ from: username }, { to: username, mode: "private" }],
    })
      .sort({ createdAt: -1 })
      .limit(50);
    socket.emit("recentMessages", recent.reverse());
  });

  // PRIVATE
  socket.on("privateMessage", async ({ to, message, from }) => {
    const targetSocket = userSockets[to];
    const doc = await Message.create({
      from,
      to,
      text: message,
      mode: "private",
    });
    if (targetSocket) io.to(targetSocket).emit("receivePrivate", doc);
    // also echo to sender (so both sides show message)
  });

  // GROUPS
  socket.on("createGroup", (groupName) => {
    if (!groups[groupName]) groups[groupName] = [];
    io.emit("groupList", Object.keys(groups));
  });

  socket.on("joinGroup", (groupName) => {
    socket.join(groupName);
    const username = users[socket.id];
    if (!groups[groupName]) groups[groupName] = [];
    if (!groups[groupName].includes(username)) groups[groupName].push(username);
    io.to(groupName).emit("groupUsers", groups[groupName]);
    io.emit("groupList", Object.keys(groups));
  });

  socket.on("leaveGroup", (groupName) => {
    socket.leave(groupName);
    const username = users[socket.id];
    if (groups[groupName])
      groups[groupName] = groups[groupName].filter((u) => u !== username);
    io.to(groupName).emit("groupUsers", groups[groupName] || []);
  });

  socket.on("groupMessage", async ({ group, from, message }) => {
    const doc = await Message.create({
      from,
      to: group,
      text: message,
      mode: "group",
    });
    io.to(group).emit("receiveGroup", doc);
  });

  // CHANNELS (public)
  socket.on("createChannel", (channel) => {
    if (!channels[channel]) channels[channel] = [];
    io.emit("channelList", Object.keys(channels));
  });

  socket.on("joinChannel", (channel) => {
    socket.join(channel);
    const username = users[socket.id];
    if (!channels[channel]) channels[channel] = [];
    if (!channels[channel].includes(username)) channels[channel].push(username);
    io.to(channel).emit("channelUsers", channels[channel]);
    io.emit("channelList", Object.keys(channels));
  });

  socket.on("leaveChannel", (channel) => {
    socket.leave(channel);
    const username = users[socket.id];
    if (channels[channel])
      channels[channel] = channels[channel].filter((u) => u !== username);
    io.to(channel).emit("channelUsers", channels[channel] || []);
  });

  socket.on("channelMessage", async ({ channel, from, message }) => {
    const doc = await Message.create({
      from,
      to: channel,
      text: message,
      mode: "channel",
    });
    io.to(channel).emit("receiveChannel", doc);
  });

  socket.on("disconnect", () => {
    const username = users[socket.id];
    delete userSockets[username];
    delete users[socket.id];
    io.emit("onlineUsers", Object.values(users));
  });
});

// Simple health route
app.get("/", (req, res) => res.send("WhatsApp-clone backend is running"));

// Connect MongoDB and start server
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
    server.listen(PORT, () => console.log("Server running on port", PORT));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    // still start server in case dev doesn't run Mongo locally
    server.listen(PORT, () =>
      console.log("Server running (no DB) on port", PORT)
    );
  });
