import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from './lib/gemini';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

// --- Icons (SVG) ---
const IconServer = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>;
const IconTerminal = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>;
const IconCpu = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>;
const IconZap = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
const IconSend = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
const IconPlay = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;

// --- Components ---

const Dashboard = ({ connection }: { connection: any }) => {
  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto">
      <header className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white">{connection?.host || 'Server'}</h1>
          <p className="text-sm text-gray-400">{connection?.username} • Online via SSH</p>
        </div>
        <button className="btn" disabled>Connected</button>
      </header>

      {/* Note: Real metrics via SSH require complex parsing. Showing placeholder visualizations for now. */}
      <div className="grid grid-cols-3 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div className="card">
          <div className="card-title flex items-center gap-2"><IconCpu /> Connection</div>
          <div className="stat-value text-blue-400">Stable</div>
          <div className="text-sm text-gray-500 mt-2">SSH Tunnel Active</div>
        </div>
        <div className="card">
          <div className="card-title flex items-center gap-2"><IconServer /> Protocol</div>
          <div className="stat-value text-green-400">SSH-2.0</div>
          <div className="text-sm text-gray-500 mt-2">Encrypted</div>
        </div>
        <div className="card">
          <div className="card-title flex items-center gap-2"><IconZap /> Latency</div>
          <div className="stat-value text-yellow-400">~24ms</div>
          <div className="text-xs text-gray-500 mt-2">Local Proxy</div>
        </div>
      </div>

      <div className="card flex-1">
        <div className="card-title">Real-Time Terminal Instructions</div>
        <div className="text-sm text-gray-300 space-y-4 p-2">
           <p>You are now connected to a real shell.</p>
           <p>1. Switch to the <strong>Terminal</strong> tab to execute commands.</p>
           <p>2. Ask the AI assistant on the right to help you write commands.</p>
           <p>3. <strong>Example:</strong> Ask AI "Show me how to update this system" and copy the command to the terminal.</p>
        </div>
      </div>
    </div>
  );
};

const RealTerminal = ({ socket, onMount }: { socket: WebSocket | null, onMount: (term: XTerm) => void }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!terminalRef.current || !socket) return;

    // Initialize xterm.js
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
      fontSize: 14,
      theme: {
        background: '#000000',
        foreground: '#f0f0f0',
        cursor: '#22c55e'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;
    
    // Notify parent
    onMount(term);

    // Send input to backend
    term.onData(data => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'resize', 
          rows: term.rows, 
          cols: term.cols,
          height: terminalRef.current?.clientHeight,
          width: terminalRef.current?.clientWidth
        }));
      }
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [socket]);

  return (
    <div className="h-full flex flex-col bg-black p-2 overflow-hidden">
       <div className="flex-1 w-full h-full overflow-hidden" ref={terminalRef}></div>
    </div>
  );
};

interface AIChatProps {
  onRunCommand: (command: string) => void;
  canRunCommands: boolean;
}

const AIChat = ({ onRunCommand, canRunCommands }: AIChatProps) => {
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: 'I am ready. Ask me to generate commands, and I can help you execute them.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    const history = messages.map(m => ({ role: m.role, text: m.text }));
    const response = await sendChatMessage(history, userMsg);
    
    setMessages(prev => [...prev, { role: 'ai', text: response }]);
    setLoading(false);
  };

  const renderMessageText = (text: string) => {
    // Split by markdown code blocks: ```lang ... ```
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        // Extract content inside code block
        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
        if (match) {
          const code = match[2].trim();
          return (
            <div key={index} className="my-2 bg-slate-900 rounded border border-slate-700 overflow-hidden">
              <div className="flex justify-between items-center px-3 py-1 bg-slate-800 border-b border-slate-700">
                <span className="text-xs text-slate-400 font-mono">SHELL</span>
                {canRunCommands && (
                  <button 
                    onClick={() => onRunCommand(code)}
                    className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition-colors"
                  >
                    <IconPlay /> Run
                  </button>
                )}
              </div>
              <pre className="p-3 text-sm font-mono text-green-300 overflow-x-auto whitespace-pre-wrap">
                {code}
              </pre>
            </div>
          );
        }
      }
      // Return regular text with line breaks
      return <span key={index} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className="chat-panel h-full">
      <div className="p-4 border-b border-gray-700 font-bold text-white flex items-center gap-2">
        <IconZap /> AI DevOps Assistant
      </div>
      
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            {m.role === 'ai' ? renderMessageText(m.text) : m.text}
          </div>
        ))}
        {loading && <div className="message ai text-gray-400">Generating command...</div>}
        <div ref={scrollRef}></div>
      </div>

      <div className="chat-input-area">
        <div className="relative">
          <textarea
            className="chat-input"
            rows={2}
            placeholder="e.g., Check disk space..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          />
          <button 
            className="absolute right-2 bottom-2 p-1 text-blue-400 hover:text-blue-300"
            onClick={handleSend}
            disabled={loading}
          >
            <IconSend />
          </button>
        </div>
      </div>
    </div>
  );
};

// Login Modal Component
const LoginModal = ({ onConnect, error, loading }: any) => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({ host, port: parseInt(port), username, password });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-800 p-8 rounded-lg border border-slate-600 w-96 shadow-2xl">
        <div className="flex justify-center mb-6">
           <div className="bg-blue-600 p-3 rounded-full"><IconServer /></div>
        </div>
        <h2 className="text-2xl font-bold text-white text-center mb-2">Connect to Server</h2>
        <p className="text-slate-400 text-center mb-6 text-sm">Real SSH Connection via Local Proxy</p>
        
        {error && <div className="bg-red-900/50 text-red-200 p-3 rounded text-sm mb-4 border border-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs uppercase text-slate-500 font-bold tracking-wider">Host IP / Domain</label>
              <input 
                required 
                type="text" 
                className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded mt-1 focus:border-blue-500 outline-none" 
                placeholder="e.g., 1.2.3.4"
                value={host}
                onChange={e => setHost(e.target.value)}
              />
            </div>
            <div className="w-24">
              <label className="text-xs uppercase text-slate-500 font-bold tracking-wider">Port</label>
              <input 
                required 
                type="number" 
                className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded mt-1 focus:border-blue-500 outline-none" 
                placeholder="22"
                value={port}
                onChange={e => setPort(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500 font-bold tracking-wider">Username</label>
            <input 
              required 
              type="text" 
              className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded mt-1 focus:border-blue-500 outline-none" 
              placeholder="root"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500 font-bold tracking-wider">Password</label>
            <input 
              required 
              type="password" 
              className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded mt-1 focus:border-blue-500 outline-none" 
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded transition-all mt-2 disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect via SSH'}
          </button>
        </form>
        <div className="mt-4 text-xs text-center text-slate-500">
           Requires <code>npm run server</code> running in terminal
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'terminal'>('terminal'); 
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [connectionError, setConnectionError] = useState('');
  const [connectionDetails, setConnectionDetails] = useState<any>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const termRef = useRef<XTerm | null>(null);

  const connectToServer = (details: any) => {
    setConnectionStatus('connecting');
    setConnectionError('');
    setConnectionDetails(details);

    const ws = new WebSocket('ws://localhost:3001');
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'connect',
        ...details
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'status' && msg.status === 'connected') {
        setConnectionStatus('connected');
        setActiveTab('terminal');
      } else if (msg.type === 'status' && msg.status === 'disconnected') {
        setConnectionStatus('disconnected');
        setConnectionError('Connection closed by server.');
      } else if (msg.type === 'error') {
        setConnectionStatus('disconnected');
        setConnectionError(msg.message);
      } else if (msg.type === 'data') {
        termRef.current?.write(msg.data);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('disconnected');
      setConnectionError('Could not connect to local proxy (ws://localhost:3001). Did you run "npm run server"?');
    };

    ws.onclose = () => {
      if (connectionStatus === 'connected') {
        setConnectionStatus('disconnected');
      }
    };
  };

  const handleRunCommand = (command: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // Switch to terminal tab so user can see result
      setActiveTab('terminal');
      // Send command + enter
      socketRef.current.send(JSON.stringify({ type: 'input', data: command + '\n' }));
    } else {
      alert("Cannot run command: Not connected to server.");
    }
  };

  return (
    <div className="flex h-full w-full bg-slate-900 text-slate-100 font-sans">
      {connectionStatus !== 'connected' && (
        <LoginModal 
          onConnect={connectToServer} 
          error={connectionError} 
          loading={connectionStatus === 'connecting'} 
        />
      )}

      {/* Sidebar */}
      <div className="sidebar">
        <div 
          className={`nav-icon ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          title="Dashboard"
        >
          <IconServer />
        </div>
        <div 
          className={`nav-icon ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminal')}
          title="Terminal"
        >
          <IconTerminal />
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content relative">
        <div className={`h-full w-full ${activeTab === 'terminal' ? 'block' : 'hidden'}`}>
           <RealTerminal 
             socket={socketRef.current} 
             onMount={(term) => termRef.current = term}
           />
        </div>
        
        {activeTab === 'dashboard' && <Dashboard connection={connectionDetails} />}
      </div>

      {/* AI Chat - Now with Run Capability */}
      <AIChat 
        onRunCommand={handleRunCommand} 
        canRunCommands={connectionStatus === 'connected'}
      />
    </div>
  );
}