import { useState } from 'react';
import api from '../api';

export default function PollPanel({ polls, setPolls, serverId, token, userId }) {
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  async function handleCreate(e) {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) return;
    try {
      await api(`/servers/${serverId}/polls`, {
        method: 'POST',
        body: JSON.stringify({ question, options: validOptions })
      }, token);
      setShowForm(false);
      setQuestion('');
      setOptions(['', '']);
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

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Polls</h3>
        <button className="btn btn-accent" onClick={() => setShowForm(true)}>+ Create Poll</button>
      </div>

      {polls.length === 0 && (
        <div className="empty-state">
          <div className="icon">&#x1F4CA;</div>
          <p>No polls yet. Create one to get your team's input!</p>
        </div>
      )}

      {polls.map(poll => {
        const total = totalVotes(poll);
        return (
          <div key={poll.id} className="card">
            <div className="card-title">{poll.question}</div>
            <div className="card-meta">
              <span>by {poll.username}</span>
              <span>{total} vote{total !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {poll.options.map(opt => {
                const pct = total > 0 ? Math.round((opt.vote_count / total) * 100) : 0;
                const isVoted = poll.userVoteOptionId === opt.id;
                return (
                  <div
                    key={opt.id}
                    className={`poll-option ${isVoted ? 'voted' : ''}`}
                    onClick={() => handleVote(poll.id, opt.id)}
                  >
                    <div className="bar" style={{ width: `${pct}%` }} />
                    <div className="opt-content">
                      <span className="opt-text">
                        {isVoted && <span style={{ marginRight: 6 }}>&#x2713;</span>}
                        {opt.option_text}
                      </span>
                      <span className="opt-count">{pct}% ({opt.vote_count})</span>
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
                      <button type="button" onClick={() => removeOption(i)}>&#x2715;</button>
                    )}
                  </div>
                ))}
                <button type="button" className="add-option-btn" onClick={addOption}>+ Add Option</button>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-accent">Create Poll</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
