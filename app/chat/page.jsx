"use client";

import {
  initSocket,
  sendMessage as rtcSend,
} from "../services/webrtc";

import { useState, useEffect, useRef } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState(1);
  const bottomRef = useRef(null);

  const seenMessages = useRef(new Set());

  useEffect(() => {
    initSocket();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    window.onConnected = () => setConnected(true);
  }, []);

  useEffect(() => {
    window.updateUserCount = (count) => setUsers(count);
  }, []);

  // ✅ DEDUP FIX
  useEffect(() => {
    window.receiveMessage = (data) => {
      if (!data?.id) return;

      if (seenMessages.current.has(data.id)) return;
      seenMessages.current.add(data.id);

      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          text: data.message,
          isOwn: false,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    };
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;

    const id = Date.now() + Math.random();

    setMessages((prev) => [
      ...prev,
      {
        id,
        text: input,
        isOwn: true,
        time: new Date().toLocaleTimeString(),
      },
    ]);

    rtcSend(input);
    setInput("");
  };

  return (
    <div className="h-[100dvh] w-full bg-[#0B0F14] text-white flex flex-col">

      {/* HEADER */}
      <div>
        <div className="bg-yellow-500 text-black text-center py-1 text-sm">
          ⚠ Mesh Network Active (Hybrid)
        </div>

        <div className="p-2 flex justify-center gap-4 bg-[#121821] text-sm">
          <span className="text-green-400">
            {connected ? "🟢 Connected" : "🟡 Connecting..."}
          </span>

          <span className="text-blue-400">
            👥 {users} Online
          </span>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.isOwn ? "justify-end" : "justify-start"
            } mb-2`}
          >
            <div
              className={`px-3 py-2 rounded-xl max-w-[70%] ${
                msg.isOwn
                  ? "bg-green-500 text-black"
                  : "bg-gray-700"
              }`}
            >
              <p>{msg.text}</p>
              <span className="text-[10px] opacity-70">
                {msg.time}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className="p-2 border-t border-gray-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 bg-[#121821] px-3 py-2 rounded-full outline-none"
          placeholder="Type message..."
        />

        <button
          onClick={sendMessage}
          className="bg-green-500 px-4 rounded-full"
        >
          Send
        </button>
      </div>
    </div>
  );
}