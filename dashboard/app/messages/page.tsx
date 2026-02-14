"use client";

import { useEffect, useState, useRef } from "react";
import { MessageSquare, Bot } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Message {
  id: string;
  agent_name?: string;
  agentName?: string;
  from?: string;
  content: string;
  type?: string;
  message_type?: string;
  timestamp?: string;
  created_at?: string;
}

const typeBadges: Record<string, string> = {
  chat: "bg-gray-800 text-gray-300 border-gray-700",
  finding: "bg-emerald-900/40 text-emerald-300 border-emerald-800",
  handoff: "bg-purple-900/40 text-purple-300 border-purple-800",
  report: "bg-blue-900/40 text-blue-300 border-blue-800",
  directive: "bg-amber-900/40 text-amber-300 border-amber-800",
  question: "bg-cyan-900/40 text-cyan-300 border-cyan-800",
};

const agentAvatarColors = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-purple-600",
  "bg-amber-600",
  "bg-pink-600",
  "bg-cyan-600",
  "bg-red-600",
  "bg-indigo-600",
  "bg-teal-600",
  "bg-orange-600",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return agentAvatarColors[Math.abs(hash) % agentAvatarColors.length];
}

function getInitials(name: string) {
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch(`${API}/api/messages`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.messages || [];
          setMessages(list);
        }
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMessages();
  }, []);

  useEffect(() => {
    if (!loading && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading, messages]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Messages</h1>
        <p className="text-gray-400 mt-1">Agent group chat and communications</p>
      </div>

      <div className="card !p-0 flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <h2 className="text-sm font-semibold text-white">Agent Group Chat</h2>
          <span className="badge bg-gray-800 text-gray-400 border border-gray-700 ml-auto">
            {messages.length} messages
          </span>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            [...Array(8)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-9 h-9 bg-gray-800 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-24 bg-gray-800 rounded" />
                    <div className="h-3 w-16 bg-gray-800 rounded" />
                  </div>
                  <div className="h-4 w-3/4 bg-gray-800 rounded" />
                  <div className="h-4 w-1/2 bg-gray-800 rounded" />
                </div>
              </div>
            ))
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
              <p>No messages yet</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const name = msg.agent_name || msg.agentName || msg.from || "Unknown";
              const msgType = msg.type || msg.message_type || "chat";
              const time = msg.timestamp || msg.created_at;

              return (
                <div
                  key={msg.id || i}
                  className="flex items-start gap-3 group hover:bg-gray-800/20 -mx-3 px-3 py-2 rounded-lg transition-colors"
                >
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white ${getAvatarColor(
                      name
                    )}`}
                  >
                    {getInitials(name)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">
                        {name}
                      </span>
                      {msgType !== "chat" && (
                        <span
                          className={`badge border text-[10px] ${
                            typeBadges[msgType] || typeBadges.chat
                          }`}
                        >
                          {msgType}
                        </span>
                      )}
                      {time && (
                        <span className="text-xs text-gray-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          {new Date(time).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
