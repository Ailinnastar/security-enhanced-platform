import { useState } from 'react';
import api from '../api';

export default function DeadlinePanel({ deadlines, serverId, token }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api(`/servers/${serverId}/deadlines`, {
        method: 'POST',
        body: JSON.stringify({ title, description: desc, due_date: dueDate })
      }, token);
      setShowForm(false);
      setTitle('');
      setDesc('');
      setDueDate('');
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleComplete(id) {
    try {
      await api(`/servers/${serverId}/deadlines/${id}/toggle`, { method: 'PUT' }, token);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id) {
    try {
      await api(`/servers/${serverId}/deadlines/${id}`, { method: 'DELETE' }, token);
    } catch (err) {
      console.error(err);
    }
  }

  function getDueBadge(dueDate, completed) {
    if (completed) return { text: 'Done', cls: 'ok' };
    const now = new Date();
    const due = new Date(dueDate);
    const diff = (due - now) / (1000 * 60 * 60 * 24);
    if (diff < 0) return { text: 'Overdue', cls: 'overdue' };
    if (diff < 3) return { text: `${Math.ceil(diff)}d left`, cls: 'soon' };
    return { text: `${Math.ceil(diff)}d left`, cls: 'ok' };
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Deadline Tracker</h3>
        <button className="btn btn-accent" onClick={() => setShowForm(true)}>+ Add Deadline</button>
      </div>

      {deadlines.length === 0 && (
        <div className="empty-state">
          <div className="icon">&#x1F4C5;</div>
          <p>No deadlines yet. Add one to keep your team on track!</p>
        </div>
      )}

      {deadlines.map(d => {
        const badge = getDueBadge(d.due_date, d.completed);
        return (
          <div key={d.id} className={`card deadline-card ${d.completed ? 'completed' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div
                className={`deadline-check ${d.completed ? 'done' : ''}`}
                onClick={() => toggleComplete(d.id)}
              >
                {d.completed && <span style={{ fontSize: '.7rem' }}>&#x2713;</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div className="card-title" style={{ textDecoration: d.completed ? 'line-through' : 'none' }}>
                  {d.title}
                </div>
                <div className="card-meta">
                  <span>Due: {formatDate(d.due_date)}</span>
                  <span className={`due-badge ${badge.cls}`}>{badge.text}</span>
                  <span>by {d.username}</span>
                </div>
                {d.description && <div className="card-body">{d.description}</div>}
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '.7rem', padding: '3px 8px' }}
                onClick={() => handleDelete(d.id)}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleCreate}>
            <h3>New Deadline</h3>
            <div className="form-group">
              <label>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Submit final report" required />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Details about this deadline..." />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-accent">Create Deadline</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
