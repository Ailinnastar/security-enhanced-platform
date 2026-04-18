import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';

const STATUS_OPTIONS = [
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

function statusLabel(status) {
  return STATUS_OPTIONS.find(s => s.id === status)?.label || status;
}

export default function TasksPanel({
  projects,
  activeProjectId,
  onSelectProject,
  tasks,
  serverId,
  token,
  user,
  onAddProject,
  onAddTask,
  onAddPart,
  onUpdatePart,
}) {
  const fileInputRef = useRef(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');

  const [showPartForm, setShowPartForm] = useState(false);
  const [partTaskId, setPartTaskId] = useState(null);
  const [partTitle, setPartTitle] = useState('');
  const [partStatus, setPartStatus] = useState('todo');
  const [partNotes, setPartNotes] = useState('');

  const [importingDoc, setImportingDoc] = useState(false);
  const [importError, setImportError] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    try {
      return localStorage.getItem('sg_gemini_api_key') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      if (geminiApiKey.trim()) localStorage.setItem('sg_gemini_api_key', geminiApiKey.trim());
      else localStorage.removeItem('sg_gemini_api_key');
    } catch {
      // ignore
    }
  }, [geminiApiKey]);

  const progress = useMemo(() => {
    const counts = { todo: 0, in_progress: 0, done: 0 };
    for (const t of tasks) {
      for (const p of t.parts || []) {
        if (counts[p.status] == null) continue;
        counts[p.status] += 1;
      }
    }
    return counts;
  }, [tasks]);

  const progressPerc = useMemo(() => {
    const total = progress.todo + progress.in_progress + progress.done;
    const pct = key => (total ? Math.round((progress[key] / total) * 100) : 0);
    return {
      todo: pct('todo'),
      in_progress: pct('in_progress'),
      done: pct('done'),
    };
  }, [progress.todo, progress.in_progress, progress.done]);

  function openAddPart(taskId) {
    setPartTaskId(taskId);
    setPartTitle('');
    setPartStatus('todo');
    setPartNotes('');
    setShowPartForm(true);
  }

  function openImportPicker() {
    if (!activeProjectId) {
      setImportError('Select a project first.');
      return;
    }
    setImportError('');
    fileInputRef.current?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!activeProjectId) {
      setImportError('Select a project first.');
      return;
    }

    setImportError('');
    setImportingDoc(true);

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'application/pdf';

      await api(
        `/servers/${serverId}/projects/${activeProjectId}/tasks/import-from-document`,
        {
          method: 'POST',
          body: JSON.stringify({
            documentBase64: base64,
            mimeType,
            fileName: file.name,
            replaceExisting: true,
            geminiApiKey: geminiApiKey.trim() || undefined,
          }),
        },
        token
      );
    } catch (err) {
      setImportError(err.message || 'Document import failed');
    } finally {
      setImportingDoc(false);
    }
  }

  async function submitProject(e) {
    e.preventDefault();
    if (!projectTitle.trim()) return;
    await onAddProject({ title: projectTitle, description: projectDesc });
    setShowProjectForm(false);
    setProjectTitle('');
    setProjectDesc('');
  }

  async function submitTask(e) {
    e.preventDefault();
    if (!taskTitle.trim() || !activeProjectId) return;
    await onAddTask({ projectId: activeProjectId, title: taskTitle });
    setShowTaskForm(false);
    setTaskTitle('');
  }

  async function submitPart(e) {
    e.preventDefault();
    if (!partTaskId || !partTitle.trim()) return;
    await onAddPart({
      taskId: partTaskId,
      title: partTitle,
      status: partStatus,
      notes: partNotes,
    });
    setShowPartForm(false);
    setPartTaskId(null);
    setPartTitle('');
    setPartStatus('todo');
    setPartNotes('');
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Projects &amp; Tasks</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setShowProjectForm(true)} title="Create a new project for this server">
            + Project
          </button>
          {activeProjectId && (
            <button type="button" className="btn btn-accent" onClick={() => setShowTaskForm(true)} title="Add a task under the selected project">
              + Task
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={openImportPicker}
            disabled={importingDoc}
            title="Import tasks/parts from a document (PDF) using Gemini"
          >
            {importingDoc ? 'Importing...' : '+ Import PDF'}
          </button>
          <input
            type="password"
            value={geminiApiKey}
            onChange={e => setGeminiApiKey(e.target.value)}
            placeholder="Gemini API key (optional)"
            style={{
              width: 240,
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg-darkest)',
              color: 'var(--text-primary)',
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            // Important: avoid `display:none` so the browser still allows
            // programmatic opening of the file picker.
            style={{
              position: 'absolute',
              opacity: 0,
              width: 1,
              height: 1,
              overflow: 'hidden',
            }}
            tabIndex={-1}
            onChange={handleImportFile}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-meta" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Progress</span>
          <span style={{ color: 'var(--text-muted)' }}>
            Todo: <b>{progress.todo}</b> · In progress: <b>{progress.in_progress}</b> · Done: <b>{progress.done}</b>
          </span>
        </div>
        <div className="progress-bars">
          <div className="progress-row">
            <span>Todo</span>
            <div className="progress-track">
              <div className="progress-fill todo" style={{ width: `${progressPerc.todo}%` }} />
            </div>
          </div>
          <div className="progress-row">
            <span>In progress</span>
            <div className="progress-track">
              <div className="progress-fill in_progress" style={{ width: `${progressPerc.in_progress}%` }} />
            </div>
          </div>
          <div className="progress-row">
            <span>Done</span>
            <div className="progress-track">
              <div className="progress-fill done" style={{ width: `${progressPerc.done}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '.8rem' }}>Select project</label>
          <select
            value={activeProjectId || ''}
            onChange={e => onSelectProject(Number(e.target.value))}
            style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-darkest)', color: 'var(--text-primary)' }}
          >
            <option value="" disabled>
              {projects.length ? 'Choose...' : 'No projects yet'}
            </option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeProjectId == null ? (
        <div className="empty-state">
          <div className="icon">&#x1F4CB;</div>
          <p>Create a project to start organizing tasks.</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="icon">&#x1F4DD;</div>
          <p>No tasks yet for this project.</p>
        </div>
      ) : (
        tasks.map(task => {
          const byStatus = {
            todo: [],
            in_progress: [],
            done: [],
          };
          for (const part of task.parts || []) {
            if (byStatus[part.status]) byStatus[part.status].push(part);
          }

          return (
            <div key={task.id} className="card" style={{ marginBottom: 16 }}>
              <div className="card-meta" style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{task.title}</span>
                <span>Parts: {(task.parts || []).length}</span>
              </div>

              <div className="task-status-grid">
                {STATUS_OPTIONS.map(s => (
                  <div key={s.id} className="task-status-col">
                    <div className="task-status-head">
                      <span>{s.label}</span>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6 }}
                        onClick={() => openAddPart(task.id)}
                        title="Add a part (you can choose status in the form)"
                      >
                        + Add
                      </button>
                    </div>
                    <div className="task-status-list">
                      {byStatus[s.id].length === 0 ? (
                        <div className="task-status-empty">No parts</div>
                      ) : (
                        byStatus[s.id].map(part => (
                          <PartCard key={part.id} part={part} onUpdatePart={onUpdatePart} />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {importError && (
        <div className="error-msg" style={{ background: 'rgba(237,66,69,.12)', color: '#ed4245', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: '.85rem', borderLeft: '3px solid #ed4245' }}>
          {importError}
        </div>
      )}

      {showProjectForm && (
        <div className="modal-overlay" onClick={() => setShowProjectForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submitProject}>
            <h3>Create Project</h3>
            <div className="form-group">
              <label>Title</label>
              <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                value={projectDesc}
                onChange={e => setProjectDesc(e.target.value)}
                placeholder="Short context for this project"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowProjectForm(false)} title="Close without creating a project">Cancel</button>
              <button type="submit" className="btn btn-accent" title="Create this project">Create</button>
            </div>
          </form>
        </div>
      )}

      {showTaskForm && (
        <div className="modal-overlay" onClick={() => setShowTaskForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submitTask}>
            <h3>Create Task</h3>
            <div className="form-group">
              <label>Title</label>
              <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowTaskForm(false)} title="Close without adding a task">Cancel</button>
              <button type="submit" className="btn btn-accent" title="Create this task under the selected project">Create</button>
            </div>
          </form>
        </div>
      )}

      {showPartForm && (
        <div className="modal-overlay" onClick={() => setShowPartForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submitPart}>
            <h3>Add Part</h3>
            <div className="form-group">
              <label>Title</label>
              <input value={partTitle} onChange={e => setPartTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={partStatus}
                onChange={e => setPartStatus(e.target.value)}
                style={{ width: '100%', padding: '.6rem .75rem', background: 'var(--bg-darkest)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes (bullets)</label>
              <textarea
                value={partNotes}
                onChange={e => setPartNotes(e.target.value)}
                placeholder="- selecting model\n-changing model\n-how to present..."
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowPartForm(false)} title="Close without adding a part">Cancel</button>
              <button type="submit" className="btn btn-accent" title="Add this part to the selected task">Add Part</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PartCard({ part, onUpdatePart }) {
  const [editing, setEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(part.title);
  const [localStatus, setLocalStatus] = useState(part.status);
  const [localNotes, setLocalNotes] = useState(part.notes || '');

  useEffect(() => {
    setLocalTitle(part.title);
    setLocalStatus(part.status);
    setLocalNotes(part.notes || '');
  }, [part.id, part.title, part.status, part.notes]);

  async function save() {
    await onUpdatePart(part.id, {
      title: localTitle,
      status: localStatus,
      notes: localNotes,
    });
    setEditing(false);
  }

  return (
    <div className="task-part-card">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="task-part-title">{localTitle}</div>
          {!editing && localNotes && <div className="task-part-notes">{localNotes}</div>}
          {editing && (
            <>
              <div style={{ marginTop: 6 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 700 }}>Status</label>
                <select
                  value={localStatus}
                  onChange={e => setLocalStatus(e.target.value)}
                  style={{ width: '100%', marginTop: 4, padding: '.6rem .75rem', background: 'var(--bg-darkest)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 6 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 700 }}>Title</label>
                <input value={localTitle} onChange={e => setLocalTitle(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '.6rem .75rem', background: 'var(--bg-darkest)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} />
              </div>
              <div style={{ marginTop: 6 }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 700 }}>Notes</label>
                <textarea value={localNotes} onChange={e => setLocalNotes(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!editing ? (
            <button type="button" className="btn btn-ghost" style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6 }} onClick={() => setEditing(true)} title="Edit title, status, and notes for this part">
              Edit
            </button>
          ) : (
            <>
              <button className="btn btn-success" style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6 }} type="button" onClick={save} title="Save changes to this part">
                Save
              </button>
              <button className="btn btn-ghost" style={{ fontSize: '.7rem', padding: '3px 8px', borderRadius: 6 }} type="button" onClick={() => setEditing(false)} title="Discard edits and keep saved version">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

