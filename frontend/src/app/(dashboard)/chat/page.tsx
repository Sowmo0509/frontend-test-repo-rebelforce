"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";
import { Document } from "@/types";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

export default function ChatPage() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Load stored document IDs from localStorage so selection from Documents page carries over
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("chatSelectedDocs");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedDocIds(parsed);
        }
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  // Load all documents for selection in sidebar
  const {
    data: allDocuments,
    isLoading: isLoadingDocs,
    error: docsError,
  } = useQuery<Document[]>({
    queryKey: ["chat-documents"],
    queryFn: async () => {
      const { data } = await api.get("/documents");
      return data;
    },
  });

  useEffect(() => {
    if (docsError) {
      toast.error("Failed to load documents for chat context");
    }
  }, [docsError]);

  const selectedDocs = useMemo(() => (allDocuments || []).filter((doc) => selectedDocIds.includes(doc.id as string)), [allDocuments, selectedDocIds]);

  const stats = useMemo(() => {
    if (!allDocuments) return { totalDocs: 0, pending: 0, approved: 0, rejected: 0 };
    const totalDocs = allDocuments.length;
    const pending = allDocuments.filter((d) => d.status === "PENDING").length;
    const approved = allDocuments.filter((d) => d.status === "APPROVED").length;
    const rejected = allDocuments.filter((d) => d.status === "REJECTED").length;
    return { totalDocs, pending, approved, rejected };
  }, [allDocuments]);

  // Chat sessions list
  const {
    data: sessions,
    isLoading: isLoadingSessions,
    refetch: refetchSessions,
  } = useQuery<ChatSession[]>({
    queryKey: ["chat-sessions"],
    queryFn: async () => {
      const { data } = await api.get("/chat/sessions");
      return data;
    },
  });

  const loadSession = async (id: string) => {
    try {
      const { data } = await api.get<ChatSession>(`/chat/sessions/${id}`);
      setCurrentSessionId(data.id);
      setMessages(
        (data.messages || []).map((m) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          createdAt: m.createdAt,
        }))
      );
    } catch {
      toast.error("Failed to load chat session");
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await api.delete(`/chat/sessions/${id}`);
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      refetchSessions();
    } catch {
      toast.error("Failed to delete chat session");
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds((prev) => {
      const exists = prev.includes(id);
      const updated = exists ? prev.filter((d) => d !== id) : [...prev, id];
      if (typeof window !== "undefined") {
        localStorage.setItem("chatSelectedDocs", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const saveDocSelection = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chatSelectedDocs", JSON.stringify(selectedDocIds));
    }
    setDocModalOpen(false);
    toast.success("Updated referenced documents for chat");
  };

  const removeDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const updated = prev.filter((d) => d !== id);
      if (typeof window !== "undefined") {
        localStorage.setItem("chatSelectedDocs", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setIsSending(true);
    const userContent = input.trim();
    setInput("");

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: userContent,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const { data } = await api.post<{
        sessionId: string;
        assistantMessage: ChatMessage;
      }>("/chat/send", {
        sessionId: currentSessionId,
        message: userContent,
        documentIds: selectedDocIds,
      });

      if (!currentSessionId) {
        setCurrentSessionId(data.sessionId);
      }

      // Replace temp user message with real one by just appending assistant and refetching session list
      setMessages((prev) => [
        ...prev,
        {
          id: data.assistantMessage.id,
          role: "assistant",
          content: data.assistantMessage.content,
          createdAt: data.assistantMessage.createdAt,
        },
      ]);

      refetchSessions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send message to AI assistant");
      // Remove the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-4 lg:grid-cols-[320px,minmax(0,1fr)] gap-4 h-[calc(100vh-10rem)] min-h-0">
      <Card className="flex flex-col h-full min-h-0 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 col-span-3">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Audit Assistant</h2>
            <p className="text-xs text-muted-foreground">Ask questions about your selected documents, compliance status, and audits.</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full px-4 py-3">
            <div className="space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground mt-10">
                  Start a conversation by asking about your documents, e.g. <span className="italic">&quot;Do my selected documents cover all quarterly reports for 2024?&quot;</span>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-50"}`}>{m.content}</div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs bg-gray-100 dark:bg-gray-800 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Thinking…</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="border-t px-4 py-3 flex gap-2">
          <Input
            placeholder="Ask a question about your compliance documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isSending) handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={isSending || !input.trim()} className="shrink-0">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>

      <div className="border rounded-lg dark:bg-gray-950 p-3 overflow-hidden min-h-0">
        {isLoadingSessions || isLoadingDocs ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <ChatSidebar sessions={sessions || []} currentSessionId={currentSessionId} loadSession={loadSession} deleteSession={deleteSession} stats={stats} selectedDocIds={selectedDocIds} selectedDocs={selectedDocs} docModalOpen={docModalOpen} setDocModalOpen={setDocModalOpen} allDocuments={allDocuments || []} toggleDocSelection={toggleDocSelection} saveDocSelection={saveDocSelection} removeDoc={removeDoc} isLoadingStats={isLoadingDocs} />
        )}
      </div>
    </div>
  );
}
