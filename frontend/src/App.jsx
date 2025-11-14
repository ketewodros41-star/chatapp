import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import {
  Send,
  LogIn,
  MessageSquare,
  Users,
  Plus,
  Users as GroupIcon,
} from "lucide-react";

const socket = io("http://localhost:5000");

export default function App() {
  const [username, setUsername] = useState("");
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState({
    global: [],
    private: {},
    groups: {},
  });
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [activeTab, setActiveTab] = useState("global");
  const [privateMessageRecipient, setPrivateMessageRecipient] = useState("");

  useEffect(() => {
    socket.on("recentMessages", (data) => {
      // Organize recent messages by type
      const organizedMessages = {
        global: [],
        private: {},
        groups: {},
      };

      data.forEach((msg) => {
        if (msg.mode === "private") {
          const otherUser = msg.from === username ? msg.to : msg.from;
          if (!organizedMessages.private[otherUser]) {
            organizedMessages.private[otherUser] = [];
          }
          organizedMessages.private[otherUser].push(msg);
        } else if (msg.mode === "group") {
          if (!organizedMessages.groups[msg.to]) {
            organizedMessages.groups[msg.to] = [];
          }
          organizedMessages.groups[msg.to].push(msg);
        } else {
          organizedMessages.global.push(msg);
        }
      });

      setMessages(organizedMessages);
    });

    socket.on("receivePrivate", (msg) => {
      const otherUser = msg.from === username ? msg.to : msg.from;
      setMessages((prev) => ({
        ...prev,
        private: {
          ...prev.private,
          [otherUser]: [...(prev.private[otherUser] || []), msg],
        },
      }));
    });

    socket.on("receiveGroup", (msg) => {
      setMessages((prev) => ({
        ...prev,
        groups: {
          ...prev.groups,
          [msg.to]: [...(prev.groups[msg.to] || []), msg],
        },
      }));
    });

    socket.on("onlineUsers", (users) => setOnlineUsers(users));
    socket.on("groupList", (groupList) => setGroups(groupList));

    return () => {
      socket.off("recentMessages");
      socket.off("receivePrivate");
      socket.off("receiveGroup");
      socket.off("onlineUsers");
      socket.off("groupList");
    };
  }, [username]);

  const register = () => {
    if (username.trim()) {
      socket.emit("register", username);
      setConnected(true);
    }
  };

  const sendMessage = () => {
    if (!message.trim()) return;

    if (activeTab === "private" && privateMessageRecipient) {
      // Send private message
      socket.emit("privateMessage", {
        to: privateMessageRecipient,
        from: username,
        message,
      });
      const newMsg = {
        from: username,
        to: privateMessageRecipient,
        text: message,
        createdAt: new Date(),
        mode: "private",
      };

      setMessages((prev) => ({
        ...prev,
        private: {
          ...prev.private,
          [privateMessageRecipient]: [
            ...(prev.private[privateMessageRecipient] || []),
            newMsg,
          ],
        },
      }));
    } else if (activeTab === "group" && selectedGroup) {
      // Send group message
      socket.emit("groupMessage", {
        group: selectedGroup,
        from: username,
        message,
      });
      const newMsg = {
        from: username,
        to: selectedGroup,
        text: message,
        createdAt: new Date(),
        mode: "group",
      };

      setMessages((prev) => ({
        ...prev,
        groups: {
          ...prev.groups,
          [selectedGroup]: [...(prev.groups[selectedGroup] || []), newMsg],
        },
      }));
    } else {
      // Send to global
      socket.emit("privateMessage", { to: "global", from: username, message });
      const newMsg = {
        from: username,
        text: message,
        createdAt: new Date(),
      };

      setMessages((prev) => ({
        ...prev,
        global: [...prev.global, newMsg],
      }));
    }
    setMessage("");
  };

  const createGroup = () => {
    if (newGroupName.trim()) {
      socket.emit("createGroup", newGroupName.trim());
      setNewGroupName("");
    }
  };

  const joinGroup = (groupName) => {
    socket.emit("joinGroup", groupName);
    setSelectedGroup(groupName);
    setActiveTab("group");
  };

  const selectUserForChat = (user) => {
    if (user !== username) {
      setPrivateMessageRecipient(user);
      setSelectedUser(user);
      setActiveTab("private");
    }
  };

  const startGroupChat = () => {
    setActiveTab("group");
    if (!selectedGroup && groups.length > 0) {
      setSelectedGroup(groups[0]);
    }
  };

  const startGlobalChat = () => {
    setActiveTab("global");
    setPrivateMessageRecipient("");
    setSelectedUser(null);
    setSelectedGroup(null);
  };

  // Get current messages based on active tab
  const getCurrentMessages = () => {
    switch (activeTab) {
      case "private":
        return messages.private[privateMessageRecipient] || [];
      case "group":
        return messages.groups[selectedGroup] || [];
      default:
        return messages.global || [];
    }
  };

  // Get chat header based on active tab
  const getChatHeader = () => {
    switch (activeTab) {
      case "private":
        return `Private chat with ${privateMessageRecipient}`;
      case "group":
        return `Group: ${selectedGroup || "Select a group"}`;
      default:
        return "Global Chat";
    }
  };

  // Check if send button should be disabled
  const isSendDisabled = () => {
    return (
      (activeTab === "private" && !privateMessageRecipient) ||
      (activeTab === "group" && !selectedGroup) ||
      !message.trim()
    );
  };

  // --- LOGIN SCREEN ---
  if (!connected)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22] p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-10 w-full max-w-md border border-white/20 text-center">
          <div className="flex justify-center mb-4">
            <MessageSquare className="text-purple-400 w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-6">P2P Chat</h1>
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && register()}
            className="w-full p-3 rounded-xl bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
          />
          <button
            onClick={register}
            className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <LogIn className="w-5 h-5" /> Connect
          </button>
        </div>
      </div>
    );

  const currentMessages = getCurrentMessages();

  // --- CHAT UI ---
  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#1e1f22] text-white">
      {/* Sidebar */}
      <div className="w-full md:w-1/4 lg:w-1/5 bg-white/10 backdrop-blur-lg border-r border-white/10 flex flex-col p-4">
        {/* User Info */}
        <div className="p-3 bg-purple-600/40 rounded-lg mb-4">
          <p className="font-semibold">{username}</p>
          <p className="text-sm text-gray-300">Online</p>
        </div>

        {/* Chat Type Selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={startGlobalChat}
            className={`flex-1 p-2 rounded-lg text-sm ${
              activeTab === "global" ? "bg-purple-600" : "bg-white/10"
            }`}
          >
            Global
          </button>
          <button
            onClick={() => setActiveTab("private")}
            className={`flex-1 p-2 rounded-lg text-sm ${
              activeTab === "private" ? "bg-purple-600" : "bg-white/10"
            }`}
          >
            Private
          </button>
          <button
            onClick={startGroupChat}
            className={`flex-1 p-2 rounded-lg text-sm ${
              activeTab === "group" ? "bg-purple-600" : "bg-white/10"
            }`}
          >
            Group
          </button>
        </div>

        {/* Online Users */}
        {(activeTab === "private" || activeTab === "global") && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="text-purple-400 w-4 h-4" />
              <h2 className="font-semibold text-sm">
                Online Users ({onlineUsers.length})
              </h2>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {onlineUsers.map((user, i) => (
                <div
                  key={i}
                  onClick={() => selectUserForChat(user)}
                  className={`p-2 rounded-lg cursor-pointer text-sm ${
                    user === username
                      ? "bg-purple-600/40"
                      : privateMessageRecipient === user
                      ? "bg-blue-600/40"
                      : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  {user} {user === username && "(You)"}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Groups Section */}
        {(activeTab === "group" || activeTab === "global") && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <GroupIcon className="text-purple-400 w-4 h-4" />
                <h2 className="font-semibold text-sm">
                  Groups ({groups.length})
                </h2>
              </div>
            </div>

            {/* Create Group Input */}
            <div className="flex gap-1 mb-2">
              <input
                type="text"
                placeholder="New group"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && createGroup()}
                className="flex-1 p-2 text-sm rounded bg-white/10 border border-white/20"
              />
              <button
                onClick={createGroup}
                className="p-2 bg-green-600 hover:bg-green-700 rounded"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Groups List */}
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {groups.map((group, i) => (
                <div
                  key={i}
                  onClick={() => joinGroup(group)}
                  className={`p-2 rounded-lg cursor-pointer text-sm ${
                    selectedGroup === group
                      ? "bg-blue-600/40"
                      : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  {group}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col backdrop-blur-md bg-white/10 border-l border-white/10">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">
            {getChatHeader()}
          </h2>
          <div className="text-sm text-gray-400">
            {currentMessages.length} messages
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-purple-400/40">
          {currentMessages.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              {activeTab === "private" && !privateMessageRecipient
                ? "Select a user to start private chat"
                : activeTab === "group" && !selectedGroup
                ? "Select or create a group to start chatting"
                : "No messages yet. Start the conversation!"}
            </div>
          ) : (
            currentMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.from === username ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                    msg.from === username
                      ? "bg-purple-500/80 text-white rounded-br-none"
                      : "bg-white/20 text-gray-200 rounded-bl-none"
                  }`}
                >
                  <p className="font-semibold">{msg.from}</p>
                  <p>{msg.text}</p>
                  {msg.mode === "private" && msg.from !== username && (
                    <p className="text-xs text-gray-400 mt-1">
                      Private message
                    </p>
                  )}
                  {msg.mode === "group" && (
                    <p className="text-xs text-gray-400 mt-1">
                      Group: {msg.to}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 flex gap-2">
          <input
            type="text"
            placeholder={
              activeTab === "private"
                ? `Message ${privateMessageRecipient || "a user"}...`
                : activeTab === "group"
                ? `Message ${selectedGroup || "a group"}...`
                : "Type your message..."
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) =>
              e.key === "Enter" && !isSendDisabled() && sendMessage()
            }
            disabled={
              (activeTab === "private" && !privateMessageRecipient) ||
              (activeTab === "group" && !selectedGroup)
            }
            className="flex-1 p-3 rounded-xl bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isSendDisabled()}
            className="px-5 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
