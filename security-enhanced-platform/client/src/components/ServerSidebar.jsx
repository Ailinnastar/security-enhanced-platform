import { useState } from 'react';
import api from '../api';

export default function ServerSidebar({ servers, activeServer, onSelect, onServersChange, token }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/servers', {
        method: 'POST',
        body: JSON.stringify({ name, description: desc })
      }, token);
      onServersChange();
      setShowCreate(false);
      setName('');
      setDesc('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/servers/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode })
      }, token);
      onServersChange();
      setShowJoin(false);
      setInviteCode('');
    } catch (err) {
      setError(err.message);
    }
  }

  function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  const colors = ['#5865F2', '#57F287', '#EB459E', '#FEE75C', '#ED4245', '#9B59B6', '#1ABC9C', '#F47B67'];

  return (
    <>
      <aside className="server-sidebar">
        {servers.map((s, i) => (
          <div
            key={s.id}
            className={`server-icon ${activeServer?.id === s.id ? 'active' : ''}`}
            style={{ background: colors[i % colors.length] }}
            onClick={() => onSelect(s)}
            title={`Open server: ${s.name}`}
          >
            {getInitials(s.name)}
          </div>
        ))}

        <div className="divider" />

        <div className="server-icon add-server" onClick={() => { setShowCreate(true); setError(''); }} title="Create Server">
          +
        </div>
        <div className="server-icon join-server" onClick={() => { setShowJoin(true); setError(''); }} title="Join Server">
          &#x2192;
        </div>
      </aside>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleCreate}>
            <h3>Create a Server</h3>
            {error && <div className="error-msg" style={{ background: 'rgba(237,66,69,.12)', color: '#ed4245', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: '.85rem', borderLeft: '3px solid #ed4245' }}>{error}</div>}
            <div className="form-group">
              <label>Server Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. COMP3000 Group A" required />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this server for?" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)} title="Close without creating a server">Cancel</button>
              <button type="submit" className="btn btn-accent" title="Create this server and add you as owner">Create Server</button>
            </div>
          </form>
        </div>
      )}

      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={handleJoin}>
            <h3>Join a Server</h3>
            {error && <div className="error-msg" style={{ background: 'rgba(237,66,69,.12)', color: '#ed4245', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: '.85rem', borderLeft: '3px solid #ed4245' }}>{error}</div>}
            <div className="form-group">
              <label>Invite Code</label>
              <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Enter invite code" required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowJoin(false)} title="Close without joining">Cancel</button>
              <button type="submit" className="btn btn-accent" title="Join a server using its invite code">Join Server</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
