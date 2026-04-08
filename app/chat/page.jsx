"use client";

import {
  initSocket,
  sendMessage as rtcSend,
} from "../services/webrtc";

import { useState, useEffect, useRef } from "react";

export default function ChatPage() {
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState(1); // 👥 NEW
  const bottomRef = useRef(null);

  // 🧠 Duplicate protection
  const seenMessages = useRef(new Set());

  // 🔌 Init
  useEffect(() => {
    initSocket();
    setConnecting(true);
  }, []);

  // 🔽 Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🟢 Connection event
  useEffect(() => {
    window.onConnected = () => {
      setConnected(true);
    };
  }, []);

  useEffect(() => {
    if (connected) setConnecting(false);
  }, [connected]);

  // 👥 Users count
  useEffect(() => {
    window.updateUserCount = (count) => {
      setUsers(count);
    };
  }, []);

  // 📩 Receive messages (FIXED)
  useEffect(() => {
    window.receiveMessage = (msg) => {
      if (seenMessages.current.has(msg)) return;
      seenMessages.current.add(msg);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text: msg,
          status: "Received",
          isOwn: false,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    };
  }, []);

  // 📤 Send message
  const sendMessage = () => {
    if (!input.trim()) return;

    const newMsg = {
      id: Date.now(),
      text: input,
      status: "Sending...",
      isOwn: true,
      time: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, newMsg]);

    rtcSend(input);

    setInput("");

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === newMsg.id
            ? { ...m, status: "Delivered" }
            : m
        )
      );
    }, 300);
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#0B0F14] text-white flex flex-col">

      {/* 🔥 HEADER */}
      <div className="shrink-0">

        {/* Banner */}
        <div className="bg-yellow-500 text-black text-center py-1 text-xs sm:text-sm">
          ⚠ Mesh Network Active (Hybrid)
        </div>

        {/* Status */}
        <div className="p-2 flex justify-center gap-4 bg-[#121821] text-sm">
          <span>
            {connected ? (
              <span className="text-green-400">🟢 Connected</span>
            ) : (
              <span className="text-yellow-400">🟡 Connecting...</span>
            )}
          </span>

          <span className="text-blue-400">
            👥 {users} Online
          </span>
        </div>

      </div>

      {/* 🔥 MESSAGES */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20 text-sm px-2">
            No messages yet.
            <br />
            Open another tab or device.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.isOwn ? "justify-end" : "justify-start"
            } mb-2`}
          >
            <div
              className={`px-3 py-2 rounded-2xl max-w-[75%] ${
                msg.isOwn
                  ? "bg-green-500 text-black"
                  : "bg-gray-700 text-white"
              }`}
            >
              <p className="text-sm">{msg.text}</p>

              <span className="text-[10px] block mt-1 opacity-70">
                {msg.status}
              </span>

              <span className="text-[9px] text-gray-300">
                {msg.time}
              </span>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* 🔥 INPUT */}
      <div className="shrink-0 p-2 border-t border-gray-800 flex gap-2 items-center">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 bg-[#121821] px-3 py-2 text-sm rounded-full outline-none"
          placeholder="Type message..."
        />

        <button
          onClick={sendMessage}
          className="bg-green-500 px-4 py-2 text-sm rounded-full"
        >
          Send
        </button>
      </div>

    </div>
  );
}