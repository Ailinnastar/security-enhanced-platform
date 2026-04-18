import { useState, useEffect, useRef } from 'react';
import api from '../api';

export default function ChatPanel({ messages, polls, setPolls, serverId, token, user, socket }) {
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const messagesEnd = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    function onTyping({ userId, username }) {
      if (userId === user.id) return;
      setTypingUsers(prev => {
        if (prev.find(u => u.userId === userId)) return prev;
        return [...prev, { userId, username }];
      });
    }

    function onStopTyping({ userId }) {
      setTypingUsers(prev => prev.filter(u => u.userId !== userId));
    }

    socket.on('user-typing', onTyping);
    socket.on('user-stop-typing', onStopTyping);
    return () => {
      socket.off('user-typing', onTyping);
      socket.off('user-stop-typing', onStopTyping);
    };
  }, [socket, user.id]);

  function handleInputChange(e) {
    setInput(e.target.value);
    if (!socket || !serverId) return;

    socket.emit('typing', { serverId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('stop-typing', { serverId });
    }, 1500);
  }

  function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || !socket || !serverId) return;
    socket.emit('send-message', { serverId, content: input.trim() });
    socket.emit('stop-typing', { serverId });
    setInput('');
  }

  async function togglePin(msgId) {
    try {
      await api(`/servers/${serverId}/messages/${msgId}/pin`, { method: 'PUT' }, token);
    } catch (err) {
      console.error('Pin error:', err);
    }
  }

  async function loadPinned() {
    try {
      const data = await api(`/servers/${serverId}/messages/pinned`, {}, token);
      setPinnedMessages(data);
      setShowPinned(true);
    } catch (err) {
      console.error(err);
    }
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Today at ${time}` : `${d.toLocaleDateString()} ${time}`;
  }

  const typingText = typingUsers.length > 0
    ? `${typingUsers.map(u => u.username).join(', ')} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`
    : '';
  function isPastPoll(poll) {
    if (!poll.results_visible_at) return false;
    return new Date(poll.results_visible_at).getTime() <= Date.now();
  }
  const unvotedPolls = polls.filter(poll => !poll.userVoteOptionId && !isPastPoll(poll));

  function totalVotes(poll) {
    return poll.options.reduce((sum, option) => sum + (option.vote_count || 0), 0);
  }

  function areResultsVisible(poll) {
    if (!poll.results_visible_at) return true;
    return new Date(poll.results_visible_at).getTime() <= Date.now();
  }

  function formatDeadline(ts) {
    return new Date(ts).toLocaleString();
  }

  async function handlePollVote(pollId, optionId) {
    try {
      const updated = await api(`/servers/${serverId}/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionId })
      }, token);
      setPolls(prev => prev.map(p => (p.id === pollId ? updated : p)));
    } catch (err) {
      console.error('Poll vote error:', err);
    }
  }

  return (
    <div className="tab-content" style={{ position: 'relative' }}>
      <div style={{ padding: '8px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '.75rem', padding: '4px 10px' }}
          onClick={loadPinned}
          title="View messages that have been pinned in this server"
        >
          Pinned Messages
        </button>
      </div>

      {unvotedPolls.length > 0 && (
        <div className="chat-pinned-polls">
          <div className="chat-pinned-polls-header">
            <span>&#x1F4CC; Unvoted Polls</span>
            <span>{unvotedPolls.length}</span>
          </div>
          {unvotedPolls.map(poll => {
            const total = totalVotes(poll);
            const resultsVisible = areResultsVisible(poll);
            return (
              <div key={poll.id} className="chat-pinned-poll-card">
                <div className="card-title">{poll.question}</div>
                <div className="card-meta">
                  <span>by {poll.username}</span>
                  {resultsVisible
                    ? <span>{total} vote{total !== 1 ? 's' : ''}</span>
                    : <span>Results hidden until {formatDeadline(poll.results_visible_at)}</span>}
                </div>
                <div>
                  {poll.options.map(option => {
                    const pct = total > 0 ? Math.round((option.vote_count / total) * 100) : 0;
                    return (
                      <div
                        key={option.id}
                        className="poll-option"
                        onClick={() => handlePollVote(poll.id, option.id)}
                      >
                        <div className="bar" style={{ width: resultsVisible ? `${pct}%` : '0%' }} />
                        <div className="opt-content">
                          <span className="opt-text">{option.option_text}</span>
                          <span className="opt-count">
                            {resultsVisible ? `${pct}% (${option.vote_count})` : 'Hidden'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="icon">&#x1F4AC;</div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="msg-group">
            <div className="msg-header">
              <div className="msg-avatar" style={{ background: msg.avatar_color }}>
                {msg.username[0].toUpperCase()}
              </div>
              <span className="msg-username" style={{ color: msg.avatar_color }}>{msg.username}</span>
              <span className="msg-time">{formatTime(msg.created_at)}</span>
              <div className="msg-actions">
                <button
                  className={msg.is_pinned ? 'pinned' : ''}
                  onClick={() => togglePin(msg.id)}
                  title={msg.is_pinned ? 'Unpin message' : 'Pin message'}
                >
                  {msg.is_pinned ? 'Unpin' : 'Pin'}
                </button>
              </div>
            </div>
            <div className="msg-content">{msg.content}</div>
            {!!msg.is_pinned && (
              <div className="msg-pinned-badge">&#x1F4CC; Pinned</div>
            )}
          </div>
        ))}
        <div ref={messagesEnd} />
      </div>

      <div className="typing-indicator">{typingText}</div>

      <form className="chat-input-area" onSubmit={sendMessage}>
        <div className="chat-input-wrapper">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
          />
          <button type="submit" title="Send your message to this server chat">Send</button>
        </div>
      </form>

      {showPinned && (
        <div className="pinned-panel">
          <div className="pinned-header">
            <span>Pinned Messages</span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '.7rem', padding: '3px 8px' }}
              onClick={() => setShowPinned(false)}
              title="Close the pinned messages panel"
            >
              Close
            </button>
          </div>
          <div className="pinned-list">
            {pinnedMessages.length === 0 && (
              <div className="empty-state" style={{ padding: 20 }}>
                <p>No pinned messages</p>
              </div>
            )}
            {pinnedMessages.map(msg => (
              <div key={msg.id} className="pinned-msg">
                <div className="msg-header" style={{ marginBottom: 4 }}>
                  <div className="msg-avatar" style={{ background: msg.avatar_color, width: 24, height: 24, fontSize: '.65rem' }}>
                    {msg.username[0].toUpperCase()}
                  </div>
                  <span className="msg-username" style={{ fontSize: '.8rem', color: msg.avatar_color }}>{msg.username}</span>
                  <span className="msg-time">{formatTime(msg.created_at)}</span>
                </div>
                <div className="msg-content" style={{ marginLeft: 34, fontSize: '.8rem' }}>{msg.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
