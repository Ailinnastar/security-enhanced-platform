import { useState, useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket } from '../socket';
import api from '../api';
import ServerSidebar from './ServerSidebar';
import ChatPanel from './ChatPanel';
import MemberSidebar from './MemberSidebar';
import DeadlinePanel from './DeadlinePanel';
import PollPanel from './PollPanel';
import VideoSummaryPanel from './VideoSummaryPanel';
import TasksPanel from './TasksPanel';

export default function Layout({ user, token, onLogout }) {
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [showMembers, setShowMembers] = useState(() => {
    const raw = localStorage.getItem('sg_show_members');
    return raw == null ? true : raw === 'true';
  });
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [polls, setPolls] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [tasks, setTasks] = useState([]);

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
        const [msgs, mems, dls, pls, sums, projs] = await Promise.all([
          api(`/servers/${activeServer.id}/messages`, {}, token),
          api(`/servers/${activeServer.id}/members`, {}, token),
          api(`/servers/${activeServer.id}/deadlines`, {}, token),
          api(`/servers/${activeServer.id}/polls`, {}, token),
          api(`/servers/${activeServer.id}/summaries`, {}, token),
          api(`/servers/${activeServer.id}/projects`, {}, token),
        ]);
        setMessages(msgs);
        setMembers(mems);
        setDeadlines(dls);
        setPolls(pls);
        setSummaries(sums);
        setProjects(projs);
        setActiveProjectId(projs[0]?.id ?? null);
        setTasks([]);
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
      'poll-updated': (poll) => setPolls(prev => prev.map(p => p.id === poll.id ? poll : p)),
      'poll-deleted': ({ id }) => setPolls(prev => prev.filter(p => p.id !== id)),
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

      'project-added': (p) => {
        setProjects(prev => {
          if (prev.some(x => x.id === p.id)) return prev;
          return [p, ...prev];
        });
      },
      'task-added': ({ projectId, task }) => {
        if (projectId !== activeProjectId) return;
        setTasks(prev => [task, ...prev]);
      },
      'task-part-added': ({ projectId, taskId, part }) => {
        if (projectId !== activeProjectId) return;
        setTasks(prev => {
          const exists = prev.some(t => t.id === taskId);
          if (!exists) {
            // If a part arrives before the task is in UI state, reload the project's tasks.
            api(`/projects/${activeProjectId}/tasks`, {}, token)
              .then(setTasks)
              .catch(err => console.error('Failed to reload tasks after task-part-added:', err));
            return prev;
          }

          return prev.map(t => {
            if (t.id !== taskId) return t;
            const nextParts = [...(t.parts || []), part].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            return { ...t, parts: nextParts };
          });
        });
      },
      'task-part-updated': ({ projectId, taskId, part }) => {
        if (projectId !== activeProjectId) return;
        setTasks(prev =>
          prev.map(t => {
            if (t.id !== taskId) return t;
            const nextParts = (t.parts || []).map(p => p.id === part.id ? part : p);
            return { ...t, parts: nextParts };
          })
        );
      },
      'task-deleted': ({ projectId, id }) => {
        if (projectId !== activeProjectId) return;
        setTasks(prev => prev.filter(t => t.id !== id));
      },
      'task-part-deleted': ({ projectId, taskId, id }) => {
        if (projectId !== activeProjectId) return;
        setTasks(prev =>
          prev.map(t => {
            if (t.id !== taskId) return t;
            return { ...t, parts: (t.parts || []).filter(p => p.id !== id) };
          })
        );
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
    };
  }, [activeServer?.id, token, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) {
      setTasks([]);
      return;
    }
    api(`/projects/${activeProjectId}/tasks`, {}, token)
      .then(setTasks)
      .catch(err => console.error('Failed to load project tasks:', err));
  }, [activeProjectId, token]);

  function handleSelectServer(server) {
    setActiveServer(server);
    setActiveTab('chat');
    setMessages([]);
    setMembers([]);
    setDeadlines([]);
    setPolls([]);
    setSummaries([]);
    setOnlineUsers([]);
    setProjects([]);
    setActiveProjectId(null);
    setTasks([]);
  }

  function copyInviteCode() {
    if (activeServer) {
      navigator.clipboard.writeText(activeServer.invite_code);
    }
  }

  function toggleMembers() {
    setShowMembers(prev => {
      const next = !prev;
      localStorage.setItem('sg_show_members', String(next));
      return next;
    });
  }

  const tabs = [
    { id: 'chat', label: 'Chat' },
    { id: 'deadlines', label: 'Deadlines' },
    { id: 'polls', label: 'Polls' },
    { id: 'tasks', label: 'Tasks' },
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
              <button
                className="btn btn-ghost"
                style={{ marginLeft: 'auto' }}
                onClick={toggleMembers}
                title={showMembers ? 'Hide members sidebar' : 'Show members sidebar'}
              >
                {showMembers ? 'Hide Members' : 'Show Members'}
              </button>
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
                polls={polls}
                setPolls={setPolls}
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
            {activeTab === 'tasks' && (
              <TasksPanel
                projects={projects}
                activeProjectId={activeProjectId}
                onSelectProject={setActiveProjectId}
                tasks={tasks}
                serverId={activeServer.id}
                token={token}
                user={user}
                onAddProject={async ({ title, description }) => {
                  const created = await api(`/servers/${activeServer.id}/projects`, {
                    method: 'POST',
                    body: JSON.stringify({ title, description })
                  }, token);
                  setProjects(prev => [created, ...prev]);
                  setActiveProjectId(prev => prev || created.id);
                }}
                onAddTask={async ({ projectId, title }) => {
                  const created = await api(`/projects/${projectId}/tasks`, {
                    method: 'POST',
                    body: JSON.stringify({ title })
                  }, token);
                  setTasks(prev => [created, ...prev]);
                }}
                onAddPart={async ({ taskId, title, status, notes }) => {
                  const created = await api(`/tasks/${taskId}/parts`, {
                    method: 'POST',
                    body: JSON.stringify({ title, status, notes })
                  }, token);
                  setTasks(prev =>
                    prev.map(t => {
                      if (t.id !== created.task_id) return t;
                      const nextParts = [...(t.parts || []), created].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                      return { ...t, parts: nextParts };
                    })
                  );
                }}
                onUpdatePart={async (partId, { title, status, notes }) => {
                  const updated = await api(`/task-parts/${partId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ title, status, notes })
                  }, token);
                  setTasks(prev =>
                    prev.map(t => ({
                      ...t,
                      parts: (t.parts || []).map(p => (p.id === partId ? updated : p))
                    }))
                  );
                }}
              />
            )}
            {activeTab === 'summaries' && (
              <VideoSummaryPanel
                summaries={summaries}
                serverId={activeServer.id}
                token={token}
                activeProjectId={activeProjectId}
              />
            )}
          </div>

          {showMembers && (
            <MemberSidebar
              members={members}
              onlineUsers={onlineUsers}
              user={user}
              onLogout={onLogout}
            />
          )}
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
