"use client";

import { useState } from "react";
import { MessageSquare, Send, Search, MoreVertical } from "lucide-react";
import { Card, Button, Input, Badge } from "@/components/ui";

const conversations = [
  {
    id: "1",
    agent: "Engineering Lead",
    avatar: "EL",
    lastMessage: "I've completed the code review for the new feature",
    time: "2m ago",
    unread: 2,
    status: "active",
  },
  {
    id: "2",
    agent: "Business Analyst",
    avatar: "BA",
    lastMessage: "The quarterly report is ready for review",
    time: "1h ago",
    unread: 0,
    status: "active",
  },
  {
    id: "3",
    agent: "DevOps Agent",
    avatar: "DO",
    lastMessage: "Deployment completed successfully",
    time: "3h ago",
    unread: 0,
    status: "paused",
  },
];

export default function MessagesPage() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Messages</h1>
        <p className="page-subtitle">Communicate with your AI agents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Conversations List */}
        <Card className="lg:col-span-1 !p-0 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="input-with-icon text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedChat(conv.id)}
                className={`w-full p-4 flex items-start gap-3 text-left transition-colors border-b border-gray-800/50 hover:bg-gray-800/30 ${
                  selectedChat === conv.id ? "bg-gray-800/50" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-medium text-white shrink-0">
                  {conv.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-white truncate">
                      {conv.agent}
                    </span>
                    <span className="text-xs text-gray-500">{conv.time}</span>
                  </div>
                  <p className="text-sm text-gray-400 truncate">
                    {conv.lastMessage}
                  </p>
                </div>
                {conv.unread > 0 && (
                  <Badge variant="primary" size="sm" className="shrink-0">
                    {conv.unread}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 !p-0 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-medium text-white">
                    EL
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Engineering Lead</h3>
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      Online
                    </p>
                  </div>
                </div>
                <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white shrink-0">
                    EL
                  </div>
                  <div className="bg-gray-800 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[80%]">
                    <p className="text-sm text-gray-200">
                      I&apos;ve completed the code review for the new feature. The
                      implementation looks good overall, but I have a few
                      suggestions.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="bg-indigo-600 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[80%]">
                    <p className="text-sm text-white">
                      Thanks for the review! What are your main concerns?
                    </p>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="input flex-1"
                  />
                  <Button leftIcon={<Send className="w-4 h-4" />}>
                    Send
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-300 mb-1">
                Select a conversation
              </h3>
              <p className="text-sm text-gray-500">
                Choose an agent from the list to start messaging
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
