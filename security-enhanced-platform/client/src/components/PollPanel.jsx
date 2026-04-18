import { useState } from 'react';
import api from '../api';

export default function PollPanel({ polls, setPolls, serverId, token, userId }) {
  const [showForm, setShowForm] = useState(false);
  const [pollTab, setPollTab] = useState('current');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [resultsVisibleAt, setResultsVisibleAt] = useState('');
  const [deadlinePreset, setDeadlinePreset] = useState('custom');
  const [xHoursLater, setXHoursLater] = useState(2);
  const [editingPollId, setEditingPollId] = useState(null);
  const [editingDeadline, setEditingDeadline] = useState('');

  function toDatetimeLocalValue(date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  function applyDeadlinePreset(preset) {
    const now = new Date();
    let target = null;

    if (preset === 'today') {
      target = new Date(now);
      target.setHours(23, 59, 0, 0);
    } else if (preset === 'in-1h') {
      target = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    } else if (preset === 'in-3h') {
      target = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    } else if (preset === 'in-6h') {
      target = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    }

    if (target) {
      setResultsVisibleAt(toDatetimeLocalValue(target));
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) return;
    try {
      await api(`/servers/${serverId}/polls`, {
        method: 'POST',
        body: JSON.stringify({ question, options: validOptions, resultsVisibleAt })
      }, token);
      setShowForm(false);
      setQuestion('');
      setOptions(['', '']);
      setResultsVisibleAt('');
      setDeadlinePreset('custom');
      setXHoursLater(2);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleVote(pollId, optionId) {
    try {
      const updated = await api(`/servers/${serverId}/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionId })
      }, token);
      setPolls(prev => prev.map(p => p.id === pollId ? updated : p));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeletePoll(pollId) {
    const confirmed = window.confirm('Delete this poll permanently?');
    if (!confirmed) return;
    try {
      await api(`/servers/${serverId}/polls/${pollId}`, { method: 'DELETE' }, token);
      setPolls(prev => prev.filter(p => p.id !== pollId));
    } catch (err) {
      console.error(err);
      window.alert(err.message || 'Failed to delete poll');
    }
  }

  async function handleUpdateDeadline(pollId) {
    try {
      const updated = await api(`/servers/${serverId}/polls/${pollId}/deadline`, {
        method: 'PUT',
        body: JSON.stringify({ resultsVisibleAt: editingDeadline })
      }, token);
      setPolls(prev => prev.map(p => p.id === pollId ? updated : p));
      setEditingPollId(null);
      setEditingDeadline('');
    } catch (err) {
      console.error(err);
      window.alert(err.message || 'Failed to update deadline');
    }
  }

  function addOption() {
    setOptions([...options, '']);
  }

  function removeOption(idx) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  }

  function updateOption(idx, val) {
    const copy = [...options];
    copy[idx] = val;
    setOptions(copy);
  }

  function totalVotes(poll) {
    return poll.options.reduce((sum, o) => sum + (o.vote_count || 0), 0);
  }

  function areResultsVisible(poll) {
    if (!poll.results_visible_at) return true;
    return new Date(poll.results_visible_at).getTime() <= Date.now();
  }

  function formatDeadline(ts) {
    return new Date(ts).toLocaleString();
  }

  function isPastPoll(poll) {
    if (!poll.results_visible_at) return false;
    return new Date(poll.results_visible_at).getTime() <= Date.now();
  }

  const currentPolls = polls.filter(p => !isPastPoll(p));
  const pastPolls = polls.filter(p => isPastPoll(p));
  const visiblePolls = pollTab === 'current' ? currentPolls : pastPolls;

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Polls</h3>
        <button type="button" className="btn btn-accent" onClick={() => setShowForm(true)} title="Open form to create a new poll for this server">+ Create Poll</button>
      </div>

      <div className="tab-bar" style={{ padding: 0, marginBottom: 12, borderRadius: 8, overflow: 'hidden' }}>
        <button type="button" className={pollTab === 'current' ? 'active' : ''} onClick={() => setPollTab('current')} title="Polls that are still open or waiting for results">
          Current ({currentPolls.length})
        </button>
        <button type="button" className={pollTab === 'past' ? 'active' : ''} onClick={() => setPollTab('past')} title="Polls whose result deadline has passed">
          Past History ({pastPolls.length})
        </button>
      </div>

      {visiblePolls.length === 0 && (
        <div className="empty-state">
          <div className="icon">&#x1F4CA;</div>
          <p>{pollTab === 'current' ? 'No current polls.' : 'No past polls yet.'}</p>
        </div>
      )}

      {visiblePolls.map(poll => {
        const total = totalVotes(poll);
        const resultsVisible = areResultsVisible(poll);
        const isOwner = poll.created_by === userId;
        const isClosed = isPastPoll(poll);
        return (
          <div key={poll.id} className="card">
            <div className="card-title">{poll.question}</div>
            <div className="card-meta">
              <span>by {poll.username}</span>
              {resultsVisible
                ? <span>{total} vote{total !== 1 ? 's' : ''}</span>
                : <span>Results hidden until {formatDeadline(poll.results_visible_at)}</span>}
            </div>
            {isOwner && (
              <div className="card-actions" style={{ marginTop: 0, marginBottom: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => {
                  setEditingPollId(poll.id);
                  setEditingDeadline(toDatetimeLocalValue(new Date(poll.results_visible_at)));
                }} title="Change when poll results become visible">
                  Modify Time
                </button>
                <button type="button" className="btn btn-danger" onClick={() => handleDeletePoll(poll.id)} title="Permanently delete this poll">
                  Delete
                </button>
              </div>
            )}
            {editingPollId === poll.id && (
              <div className="option-row" style={{ marginBottom: 8 }}>
                <input
                  type="datetime-local"
                  value={editingDeadline}
                  onChange={e => setEditingDeadline(e.target.value)}
                />
                <button type="button" className="btn btn-success" onClick={() => handleUpdateDeadline(poll.id)} title="Save the new results-visible time">
                  Save
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => {
                  setEditingPollId(null);
                  setEditingDeadline('');
                }} title="Discard deadline edits">
                  Cancel
                </button>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              {poll.options.map(opt => {
                const pct = total > 0 ? Math.round((opt.vote_count / total) * 100) : 0;
                const isVoted = poll.userVoteOptionId === opt.id;
                return (
                  <div
                    key={opt.id}
                    className={`poll-option ${isVoted ? 'voted' : ''}`}
                    onClick={() => {
                      if (!isClosed) handleVote(poll.id, opt.id);
                    }}
                    style={{ cursor: isClosed ? 'default' : 'pointer', opacity: isClosed ? 0.85 : 1 }}
                    title={isClosed ? 'This poll is closed' : `Vote for: ${opt.option_text}`}
                  >
                    <div className="bar" style={{ width: resultsVisible ? `${pct}%` : '0%' }} />
                    <div className="opt-content">
                      <span className="opt-text">
                        {isVoted && <span style={{ marginRight: 6 }}>&#x2713;</span>}
                        {opt.option_text}
                      </span>
                      <span className="opt-count">
                        {resultsVisible ? `${pct}% (${opt.vote_count})` : 'Hidden'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleCreate}>
            <h3>Create a Poll</h3>
            <div className="form-group">
              <label>Question</label>
              <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="What do you want to ask?" required />
            </div>
            <div className="form-group">
              <label>Options</label>
              <div className="option-inputs">
                {options.map((opt, i) => (
                  <div key={i} className="option-row">
                    <input
                      value={opt}
                      onChange={e => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      required
                    />
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} title="Remove this answer option">&#x2715;</button>
                    )}
                  </div>
                ))}
                <button type="button" className="add-option-btn" onClick={addOption} title="Add another answer choice to the poll">+ Add Option</button>
              </div>
            </div>
            <div className="form-group">
              <label>Results Visible At</label>
              <div className="option-inputs" style={{ marginBottom: 8 }}>
                <select
                  value={deadlinePreset}
                  onChange={e => {
                    const preset = e.target.value;
                    setDeadlinePreset(preset);
                    if (preset !== 'custom') applyDeadlinePreset(preset);
                  }}
                >
                  <option value="custom">Custom date/time</option>
                  <option value="today">Today (11:59 PM)</option>
                  <option value="in-1h">1 hour later</option>
                  <option value="in-3h">3 hours later</option>
                  <option value="in-6h">6 hours later</option>
                </select>
                <div className="option-row">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={xHoursLater}
                    onChange={e => setXHoursLater(Number(e.target.value) || 1)}
                    placeholder="X"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      const hours = Math.max(1, Number(xHoursLater) || 1);
                      const target = new Date(Date.now() + hours * 60 * 60 * 1000);
                      setResultsVisibleAt(toDatetimeLocalValue(target));
                      setDeadlinePreset('custom');
                    }}
                    title="Set results-visible time to X hours from now"
                  >
                    Set X hours later
                  </button>
                </div>
              </div>
              <input
                type="datetime-local"
                value={resultsVisibleAt}
                onChange={e => {
                  setResultsVisibleAt(e.target.value);
                  setDeadlinePreset('custom');
                }}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)} title="Close without creating a poll">Cancel</button>
              <button type="submit" className="btn btn-accent" title="Create this poll on the server">Create Poll</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
