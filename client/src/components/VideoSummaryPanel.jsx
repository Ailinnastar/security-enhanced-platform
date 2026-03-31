import { useState } from 'react';
import api from '../api';

export default function VideoSummaryPanel({ summaries, serverId, token, activeProjectId }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [transcript, setTranscript] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    try {
      setGenError('');
      if (transcript.trim() && activeProjectId) {
        setGenerating(true);
        try {
          await api(`/servers/${serverId}/projects/${activeProjectId}/minutes/generate-from-transcript`, {
            method: 'POST',
            body: JSON.stringify({
              title,
              transcript,
              meetingDate: meetingDate || undefined,
            })
          }, token);
        } catch (err) {
          console.error(err);
          setGenError(err.message || 'AI notes/minutes generation failed');
        } finally {
          setGenerating(false);
        }
      } else {
        const created = await api(`/servers/${serverId}/summaries`, {
          method: 'POST',
          body: JSON.stringify({ title, summary, meeting_date: meetingDate || undefined })
        }, token);

        if (activeProjectId) {
          setGenerating(true);
          try {
            await api(`/servers/${serverId}/projects/${activeProjectId}/minutes/generate`, {
              method: 'POST',
              body: JSON.stringify({ meetingSummaryId: created.id })
            }, token);
          } catch (err) {
            console.error(err);
            setGenError(err.message || 'Minutes generation failed');
          } finally {
            setGenerating(false);
          }
        }
      }

      setShowForm(false);
      setTitle('');
      setSummary('');
      setMeetingDate('');
      setTranscript('');
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id) {
    try {
      await api(`/servers/${serverId}/summaries/${id}`, { method: 'DELETE' }, token);
    } catch (err) {
      console.error(err);
    }
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Meeting Notes &amp; Video Call Summaries</h3>
        <button className="btn btn-accent" onClick={() => setShowForm(true)}>+ Add Summary</button>
      </div>

      {generating && (
        <div className="empty-state" style={{ padding: 20, textAlign: 'left' }}>
          <p style={{ color: 'var(--text-muted)' }}>Generating task minutes from meeting + chat...</p>
        </div>
      )}
      {genError && (
        <div className="error-msg" style={{ background: 'rgba(237,66,69,.12)', color: '#ed4245', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: '.85rem', borderLeft: '3px solid #ed4245' }}>
          {genError}
        </div>
      )}

      {summaries.length === 0 && (
        <div className="empty-state">
          <div className="icon">&#x1F4F9;</div>
          <p>No meeting summaries yet. Add notes from your video calls and meetings!</p>
        </div>
      )}

      {summaries.map(s => (
        <div key={s.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="card-title">{s.title}</div>
              <div className="card-meta">
                <span>{formatDate(s.meeting_date)}</span>
                <span>by {s.username}</span>
              </div>
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '.7rem', padding: '3px 8px' }}
              onClick={() => handleDelete(s.id)}
            >
              Delete
            </button>
          </div>
          <div className="card-body summary-body" style={{ marginTop: 8 }}>{s.summary}</div>
        </div>
      ))}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleCreate}>
            <h3>Add Meeting Summary</h3>
            <div className="form-group">
              <label>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Sprint Planning Call" required />
            </div>
            <div className="form-group">
              <label>Meeting Date</label>
              <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Summary / Key Notes</label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="Key discussion points, decisions made, action items..."
                rows={6}
              />
            </div>
            <div className="form-group">
              <label>Meeting Transcript (paste text)</label>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                placeholder="Paste transcript here. If filled, AI will generate meeting notes from it."
                rows={8}
              />
              <div style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginTop: 8 }}>
                Tip: If transcript is filled and you have an active project selected, the AI will generate notes from the transcript automatically.
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-accent">Save Summary</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
