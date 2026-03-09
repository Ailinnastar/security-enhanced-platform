import { useState, useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket } from '../socket';
import api from '../api';
import ServerSidebar from './ServerSidebar';
import ChatPanel from './ChatPanel';
import MemberSidebar from './MemberSidebar';
import DeadlinePanel from './DeadlinePanel';
import PollPanel from './PollPanel';
import VideoSummaryPanel from './VideoSummaryPanel';

export default function Layout({ user, token, onLogout }) {
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [polls, setPolls] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socketRef = useRef(null);
  const prevServerRef = useRef(null);

  const loadServers = useCallback(async () => {
    try {
      const data = await api('/servers', {}, token);
      setServers(data);
    } catch (err) {
      console.error('Failed to load servers:', err);
    }
  }, [token]);

  useEffect(() => {
    const socket = connectSocket(token);
    socketRef.current = socket;
    loadServers();
    return () => disconnectSocket();
  }, [token, loadServers]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeServer) return;

    if (prevServerRef.current) {
      socket.emit('leave-server', prevServerRef.current);
    }
    prevServerRef.current = activeServer.id;
    socket.emit('join-server', activeServer.id);

    async function loadAll() {
      try {
        const [msgs, mems, dls, pls, sums] = await Promise.all([
          api(`/servers/${activeServer.id}/messages`, {}, token),
          api(`/servers/${activeServer.id}/members`, {}, token),
          api(`/servers/${activeServer.id}/deadlines`, {}, token),
          api(`/servers/${activeServer.id}/polls`, {}, token),
          api(`/servers/${activeServer.id}/summaries`, {}, token),
        ]);
        setMessages(msgs);
        setMembers(mems);
        setDeadlines(dls);
        setPolls(pls);
        setSummaries(sums);
      } catch (err) {
        console.error('Failed to load server data:', err);
      }
    }
    loadAll();

    const handlers = {
      'new-message': (msg) => setMessages(prev => [...prev, msg]),
      'message-pinned': (msg) => setMessages(prev => prev.map(m => m.id === msg.id ? msg : m)),
      'online-users': (users) => setOnlineUsers(users),
      'member-joined': () => api(`/servers/${activeServer.id}/members`, {}, token).then(setMembers).catch(console.error),
      'deadline-added': (d) => setDeadlines(prev => [...prev, d].sort((a, b) => new Date(a.due_date) - new Date(b.due_date))),
      'deadline-updated': (d) => setDeadlines(prev => prev.map(x => x.id === d.id ? d : x)),
      'deadline-deleted': ({ id }) => setDeadlines(prev => prev.filter(x => x.id !== id)),
      'poll-added': (p) => setPolls(prev => [p, ...prev]),
      'poll-votes-updated': ({ pollId, options }) => {
        setPolls(prev => prev.map(p => {
          if (p.id !== pollId) return p;
          const updated = p.options.map(opt => {
            const fresh = options.find(o => o.id === opt.id);
            return fresh ? { ...opt, vote_count: fresh.vote_count } : opt;
          });
          return { ...p, options: updated };
        }));
      },
      'summary-added': (s) => setSummaries(prev => [s, ...prev]),
      'summary-deleted': ({ id }) => setSummaries(prev => prev.filter(x => x.id !== id)),
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
    };
  }, [activeServer?.id, token]);

  function handleSelectServer(server) {
    setActiveServer(server);
    setActiveTab('chat');
    setMessages([]);
    setMembers([]);
    setDeadlines([]);
    setPolls([]);
    setSummaries([]);
    setOnlineUsers([]);
  }

  function copyInviteCode() {
    if (activeServer) {
      navigator.clipboard.writeText(activeServer.invite_code);
    }
  }

  const tabs = [
    { id: 'chat', label: 'Chat' },
    { id: 'deadlines', label: 'Deadlines' },
    { id: 'polls', label: 'Polls' },
    { id: 'summaries', label: 'Meeting Notes' },
  ];

  return (
    <div className="layout">
      <ServerSidebar
        servers={servers}
        activeServer={activeServer}
        onSelect={handleSelectServer}
        onServersChange={loadServers}
        token={token}
      />

      {activeServer ? (
        <>
          <div className="content-area">
            <div className="top-bar">
              <h2># {activeServer.name}</h2>
              {activeServer.description && (
                <span className="server-desc">{activeServer.description}</span>
              )}
              <span className="invite-code" onClick={copyInviteCode} title="Click to copy invite code">
                Invite: {activeServer.invite_code}
              </span>
            </div>

            <div className="tab-bar">
              {tabs.map(t => (
                <button
                  key={t.id}
                  className={activeTab === t.id ? 'active' : ''}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'chat' && (
              <ChatPanel
                messages={messages}
                serverId={activeServer.id}
                token={token}
                user={user}
                socket={socketRef.current}
              />
            )}
            {activeTab === 'deadlines' && (
              <DeadlinePanel
                deadlines={deadlines}
                serverId={activeServer.id}
                token={token}
              />
            )}
            {activeTab === 'polls' && (
              <PollPanel
                polls={polls}
                setPolls={setPolls}
                serverId={activeServer.id}
                token={token}
                userId={user.id}
              />
            )}
            {activeTab === 'summaries' && (
              <VideoSummaryPanel
                summaries={summaries}
                serverId={activeServer.id}
                token={token}
              />
            )}
          </div>

          <MemberSidebar
            members={members}
            onlineUsers={onlineUsers}
            user={user}
            onLogout={onLogout}
          />
        </>
      ) : (
        <div className="welcome">
          <div className="welcome-inner">
            <div className="logo">&#x1F393;</div>
            <h2>Welcome to StudyGroup</h2>
            <p>
              Select a server from the sidebar, or create a new one to get started
              collaborating with your team.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
