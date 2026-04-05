"use client";

import {
  initSocket,
  startCall,
  sendMessage as rtcSend,
} from "../services/webrtc";

import { useState, useEffect, useRef } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);

  // 🔌 Init WebSocket once
  useEffect(() => {
    initSocket();
  }, []);

  // 🔽 Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🟢 Connection event
  useEffect(() => {
    window.onConnected = () => {
      console.log("✅ Connected triggered");
      setConnected(true);
    };
  }, []);

  // 📩 Receive messages
  useEffect(() => {
    window.receiveMessage = (msg) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: msg,
          status: "Received via P2P",
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
            ? { ...m, status: "Delivered via P2P" }
            : m
        )
      );
    }, 300);
  };

  return (
    <div className="h-screen bg-[#0B0F14] text-white flex flex-col">
      {/* Banner */}
      <div className="bg-yellow-500 text-black text-center py-1 text-sm">
        ⚠ Mesh Network Active (P2P)
      </div>

      {/* Start Button ONLY */}
      <div className="p-2 flex justify-center bg-[#121821] text-sm">
        <button
          className="bg-blue-500 px-4 py-1 rounded"
          onClick={async () => {
            await startCall();
          }}
        >
          Start Network
        </button>
      </div>

      {/* Status */}
      <div className="text-center text-xs mt-2">
        {connected ? (
          <span className="text-green-400">🟢 Connected</span>
        ) : (
          <span className="text-red-400">🔴 Waiting for peer...</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            No messages yet.
            <br />
            Open another tab and click Start there too.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.isOwn ? "justify-end" : "justify-start"
            } mb-3`}
          >
            <div
              className={`p-3 rounded-lg max-w-xs ${
                msg.isOwn
                  ? "bg-green-500 text-black"
                  : "bg-gray-700 text-white"
              }`}
            >
              <p>{msg.text}</p>

              <span className="text-xs block mt-1 opacity-70">
                {msg.status}
              </span>

              <span className="text-[10px] text-gray-400">
                {msg.time}
              </span>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && sendMessage()
          }
          className="flex-1 bg-[#121821] p-3 rounded-full outline-none"
          placeholder="Type message..."
        />

        <button
          onClick={sendMessage}
          className="bg-green-500 px-5 rounded-full"
        >
          Send
        </button>
      </div>
    </div>
  );
}