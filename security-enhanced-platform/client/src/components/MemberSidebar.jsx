export default function MemberSidebar({ members, onlineUsers, user, onLogout }) {
  const online = members.filter(m => onlineUsers.includes(m.id));
  const offline = members.filter(m => !onlineUsers.includes(m.id));

  return (
    <aside className="member-sidebar">
      <div className="sidebar-header">Members &mdash; {members.length}</div>
      <div className="member-list">
        {online.length > 0 && (
          <>
            <div className="member-section-title">Online &mdash; {online.length}</div>
            {online.map(m => (
              <div key={m.id} className="member-item">
                <div className="member-avatar" style={{ background: m.avatar_color }}>
                  {m.username[0].toUpperCase()}
                  <div className="online-dot online" />
                </div>
                <div>
                  <div className="member-name">{m.username}</div>
                  {m.role === 'owner' && <div className="member-role">Owner</div>}
                </div>
              </div>
            ))}
          </>
        )}
        {offline.length > 0 && (
          <>
            <div className="member-section-title">Offline &mdash; {offline.length}</div>
            {offline.map(m => (
              <div key={m.id} className="member-item">
                <div className="member-avatar" style={{ background: m.avatar_color, opacity: .5 }}>
                  {m.username[0].toUpperCase()}
                  <div className="online-dot offline" />
                </div>
                <div>
                  <div className="member-name" style={{ opacity: .5 }}>{m.username}</div>
                  {m.role === 'owner' && <div className="member-role" style={{ opacity: .5 }}>Owner</div>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="user-bar">
        <div className="member-avatar" style={{ background: user.avatar_color, width: 32, height: 32, fontSize: '.75rem' }}>
          {user.username[0].toUpperCase()}
        </div>
        <div className="user-info">
          <div className="uname">{user.username}</div>
        </div>
        <button type="button" onClick={onLogout} title="Sign out and return to the login screen">Logout</button>
      </div>
    </aside>
  );
}
