"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  isThinking?: boolean;
  thinking?: string;
  toolTrace?: ToolTrace[];
}

interface ToolTrace {
  tool: string;
  args: any;
  result: any;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "brief">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [briefMarkdown, setBriefMarkdown] = useState<string>("");
  const [isBriefLoading, setIsBriefLoading] = useState(false);

  // BYOK Settings
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [tempKey, setTempKey] = useState(""); // Temporary state for input
  const [apiProvider, setApiProvider] = useState("openrouter");
  const [tempProvider, setTempProvider] = useState("openrouter");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize session & load key
  useEffect(() => {
    let sid = localStorage.getItem("liq_pulse_session_id");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("liq_pulse_session_id", sid);
    }
    setSessionId(sid);

    const savedKey = localStorage.getItem("liq_pulse_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setTempKey(savedKey);
    }

    const savedProvider = localStorage.getItem("liq_pulse_api_provider");
    if (savedProvider) {
      setApiProvider(savedProvider);
      setTempProvider(savedProvider);
    }

    // Load history
    fetch(`${API_URL}/llm/history?session_id=${sid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setMessages(data.messages);
        }
      })
      .catch((err) => console.error("Failed to load history:", err));
  }, []);

  // Open settings handler
  const openSettings = () => {
    setTempKey(apiKey); // Reset temp key to current actual key
    setTempProvider(apiProvider);
    setShowSettings(true);
  };

  // Save key
  const handleSaveKey = () => {
    setApiKey(tempKey);
    setApiProvider(tempProvider);
    if (tempKey) {
      localStorage.setItem("liq_pulse_api_key", tempKey);
    } else {
      localStorage.removeItem("liq_pulse_api_key");
    }
    localStorage.setItem("liq_pulse_api_provider", tempProvider);
    setShowSettings(false);
  };

  // Cancel settings
  const handleCancelSettings = () => {
    setTempKey(apiKey); // Revert
    setTempProvider(apiProvider);
    setShowSettings(false);
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, showThinking]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (!apiKey) {
      alert("Please enter your LLM API Key in Settings to chat.");
      openSettings();
      return;
    }

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const url = new URL(`${API_URL}/llm/ask_stream`);
      url.searchParams.append("question", userMsg);
      url.searchParams.append("session_id", sessionId);

      const response = await fetch(url.toString(), {
        headers: {
          "X-LLM-API-Key": apiKey,
          "X-LLM-Provider": apiProvider,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to connect");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      let currentAssistantMsg = "";
      let currentThinking = "";
      // Temporary message placeholder
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", thinking: "", isThinking: true },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const eventMatch = line.match(/^event: (.*)$/m);
          const dataMatch = line.match(/^data: (.*)$/m);

          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === "thinking_token") {
            currentThinking += data.text;
            setMessages((prev) => {
              const newMsgs = [...prev];
              const last = newMsgs[newMsgs.length - 1];
              if (last.role === "assistant") {
                last.thinking = currentThinking;
              }
              return newMsgs;
            });
          } else if (event === "answer_token" || event === "message") {
            // Fallback
          } else if (event === "final") {
            if (data.answer) {
              setMessages((prev) => {
                const newMsgs = [...prev];
                const last = newMsgs[newMsgs.length - 1];
                last.content = data.answer;
                last.isThinking = false;
                last.toolTrace = data.tool_trace;
                return newMsgs;
              });
            }
          } else if (event === "error") {
            console.error("Stream error", data);
          }
        }
      }
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error: Failed to connect or invalid key.",
        },
      ]);
      setIsLoading(false);
    }
  };

  // Handling Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleGenerateBrief = async () => {
    setIsBriefLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["X-LLM-API-Key"] = apiKey;
        headers["X-LLM-Provider"] = apiProvider;
      }

      const res = await fetch(`${API_URL}/llm/brief`, {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Failed to generate brief");
      const data = await res.json();
      setBriefMarkdown(data.markdown);
    } catch (err) {
      setBriefMarkdown(
        "Error generating brief. Please ensure API Key is set or try again."
      );
    } finally {
      setIsBriefLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg flex items-center justify-center transition-all z-50 hover:scale-105"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-[#1a2234] border border-[#2d3a50] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Settings Overlay */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-[#1a2234] flex flex-col p-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-white">Settings</h3>
            {/* The X here should close the widget? The user said "the x on top should close the whole widget, not act as cancel"
                This implies they want the main widget X to be visible/functional? 
                But this is an overlay. 
                Standard UI: Overlay blocks main UI. 
                I will remove the X from Settings entirely to avoid confusion, 
                forcing use of Save/Cancel.
             */}
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-sm text-[#94a3b8] mb-1">
                LLM Provider
              </label>
              <div className="flex bg-[#0f1521] border border-[#2d3a50] rounded-lg p-1 mb-4">
                <button
                  onClick={() => setTempProvider("openrouter")}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded-md transition-colors",
                    tempProvider === "openrouter"
                      ? "bg-[#1a2234] text-cyan-400 shadow-sm border border-[#2d3a50]/50"
                      : "text-[#64748b] hover:text-[#94a3b8]"
                  )}
                >
                  OpenRouter
                </button>
                <button
                  onClick={() => setTempProvider("openai")}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded-md transition-colors",
                    tempProvider === "openai"
                      ? "bg-[#1a2234] text-cyan-400 shadow-sm border border-[#2d3a50]/50"
                      : "text-[#64748b] hover:text-[#94a3b8]"
                  )}
                >
                  OpenAI
                </button>
              </div>

              <label className="block text-sm text-[#94a3b8] mb-1">
                API Key
              </label>
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveKey();
                }}
                placeholder="sk-..."
                className="w-full bg-[#0f1521] border border-[#2d3a50] rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                autoFocus
              />
              <p className="text-xs text-[#64748b] mt-1">
                Stored locally in your browser.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-auto">
            <button
              onClick={handleCancelSettings}
              className="flex-1 px-4 py-2 rounded-lg border border-[#2d3a50] text-[#94a3b8] hover:text-white hover:bg-[#2d3a50] transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveKey}
              className="flex-1 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors text-sm font-medium"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3a50] bg-[#111827]">
        <h3 className="font-semibold text-[#e2e8f0] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Liquidity AI
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={openSettings}
            className="text-[#64748b] hover:text-[#e2e8f0] p-1 rounded-md hover:bg-[#1f2937]"
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (confirm("Clear chat history?")) {
                setMessages([]);
                fetch(`${API_URL}/llm/history?session_id=${sessionId}`, {
                  method: "DELETE",
                });
              }
            }}
            className="text-xs text-[#64748b] hover:text-[#94a3b8]"
            title="Clear History"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-[#64748b] hover:text-[#e2e8f0] p-1 rounded-md hover:bg-[#1f2937]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2d3a50] bg-[#1a2234]">
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium transition-colors relative",
            activeTab === "chat"
              ? "text-cyan-400"
              : "text-[#64748b] hover:text-[#94a3b8]"
          )}
        >
          Chat
          {activeTab === "chat" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("brief")}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium transition-colors relative",
            activeTab === "brief"
              ? "text-cyan-400"
              : "text-[#64748b] hover:text-[#94a3b8]"
          )}
        >
          Daily Brief
          {activeTab === "brief" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#0f1521]">
        {activeTab === "chat" ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-[#64748b] space-y-2">
                  <p className="text-sm">
                    Ask about liquidity conditions, specific indicators, or
                    historical trends.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {[
                      "How is Net Liquidity?",
                      "Explain Reverse Repo",
                      "What happened last week?",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setInput(q);
                        }}
                        className="text-xs bg-[#1a2234] border border-[#2d3a50] px-2 py-1 rounded hover:border-cyan-400/50 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col max-w-[85%] rounded-xl px-4 py-3 text-sm",
                    msg.role === "user"
                      ? "self-end bg-cyan-500/10 border border-cyan-500/20 text-cyan-50"
                      : "self-start bg-[#1a2234] border border-[#2d3a50] text-[#e2e8f0]"
                  )}
                >
                  {/* Thinking Block */}
                  {msg.thinking && showThinking && (
                    <div className="mb-2 p-2 rounded bg-[#0f1521] border border-[#2d3a50]/50 text-xs text-[#64748b] font-mono whitespace-pre-wrap italic">
                      {msg.thinking}
                    </div>
                  )}

                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>

                  {msg.role === "assistant" &&
                    msg.isThinking &&
                    !msg.content && (
                      <div className="mt-2 text-xs text-[#64748b] animate-pulse">
                        Thinking...
                      </div>
                    )}

                  {msg.toolTrace &&
                    msg.toolTrace.length > 0 &&
                    showThinking && (
                      <div className="mt-3 pt-3 border-t border-[#2d3a50]/50 space-y-2">
                        <p className="text-[10px] uppercase font-bold text-[#64748b]">
                          Tools Used
                        </p>
                        {msg.toolTrace.map((t, ti) => (
                          <div
                            key={ti}
                            className="text-xs bg-[#0f1521] p-2 rounded border border-[#2d3a50]/50 font-mono"
                          >
                            <div className="text-cyan-400/80 mb-1">
                              {t.tool}
                            </div>
                            <div className="text-[#64748b] truncate">
                              {JSON.stringify(t.result)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#1a2234] border-t border-[#2d3a50]">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  className="w-full bg-[#0f1521] border border-[#2d3a50] rounded-xl pl-4 pr-12 py-3 text-sm text-[#e2e8f0] focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none outline-none h-[50px] max-h-[120px]"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-[#64748b] cursor-pointer hover:text-[#94a3b8]">
                  <input
                    type="checkbox"
                    checked={showThinking}
                    onChange={(e) => setShowThinking(e.target.checked)}
                    className="rounded border-[#2d3a50] bg-[#0f1521] text-cyan-500 focus:ring-0 focus:ring-offset-0"
                  />
                  Show thinking & tools
                </label>
                <span className="text-[10px] text-[#475569]">
                  Enter to send
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#2d3a50] bg-[#1a2234] flex justify-between items-center">
              <div>
                <h4 className="font-medium text-sm">Market Brief</h4>
                <p className="text-xs text-[#64748b]">
                  AI-generated daily summary
                </p>
              </div>
              <button
                onClick={handleGenerateBrief}
                disabled={isBriefLoading}
                className="text-xs px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-all disabled:opacity-50"
              >
                {isBriefLoading ? "Generating..." : "Regenerate"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-[#0f1521]">
              {briefMarkdown ? (
                <div className="prose prose-invert prose-sm max-w-none prose-headings:text-cyan-400 prose-a:text-cyan-400 prose-strong:text-[#e2e8f0] text-[#94a3b8]">
                  <div className="whitespace-pre-wrap">{briefMarkdown}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[#64748b] space-y-4">
                  <svg
                    className="w-12 h-12 text-[#2d3a50]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-sm">No brief generated yet.</p>
                  <button
                    onClick={handleGenerateBrief}
                    className="px-4 py-2 bg-[#2d3a50] hover:bg-[#3d4a60] text-[#e2e8f0] rounded-lg text-sm transition-colors"
                  >
                    Generate Now
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
