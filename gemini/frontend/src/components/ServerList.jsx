import { useState } from 'react';
import axios from 'axios';
import { Plus, Search } from 'lucide-react';

export default function ServerList({ servers, currentServer, setCurrentServer, fetchServers, token }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [joinServerId, setJoinServerId] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3002/api/servers', { name: newServerName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewServerName('');
      setShowCreate(false);
      fetchServers();
    } catch (err) {
      alert('Error creating server');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3002/api/servers/join', { serverId: joinServerId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJoinServerId('');
      setShowJoin(false);
      fetchServers();
    } catch (err) {
      alert('Server not found or error joining');
    }
  };

  return (
    <div className="w-64 bg-gray-900 text-gray-100 flex flex-col">
      <div className="p-4 font-bold text-xl border-b border-gray-800 flex justify-between items-center">
        <span>UniGroup</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {servers.map(s => (
          <button
            key={s.id}
            onClick={() => setCurrentServer(s)}
            className={`w-full text-left px-3 py-2 rounded-md truncate transition-colors ${
              currentServer?.id === s.id ? 'bg-indigo-600 text-white' : 'hover:bg-gray-800'
            }`}
          >
            # {s.name}
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-gray-800 space-y-2">
        {showCreate ? (
          <form onSubmit={handleCreate} className="space-y-2">
            <input 
              autoFocus
              type="text" 
              placeholder="Server Name" 
              className="w-full bg-gray-800 border-none rounded px-2 py-1 text-sm text-white"
              value={newServerName} onChange={e => setNewServerName(e.target.value)} required 
            />
            <div className="flex space-x-2">
              <button type="submit" className="flex-1 bg-indigo-600 rounded text-xs py-1">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-700 rounded text-xs py-1">Cancel</button>
            </div>
          </form>
        ) : (
          <button onClick={() => {setShowCreate(true); setShowJoin(false);}} className="w-full flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 py-2 rounded text-sm text-gray-300">
            <Plus className="w-4 h-4" /> <span>Create Server</span>
          </button>
        )}

        {showJoin ? (
          <form onSubmit={handleJoin} className="space-y-2 mt-2">
            <input 
              autoFocus
              type="text" 
              placeholder="Server ID" 
              className="w-full bg-gray-800 border-none rounded px-2 py-1 text-sm text-white"
              value={joinServerId} onChange={e => setJoinServerId(e.target.value)} required 
            />
            <div className="flex space-x-2">
              <button type="submit" className="flex-1 bg-green-600 rounded text-xs py-1">Join</button>
              <button type="button" onClick={() => setShowJoin(false)} className="flex-1 bg-gray-700 rounded text-xs py-1">Cancel</button>
            </div>
          </form>
        ) : (
          <button onClick={() => {setShowJoin(true); setShowCreate(false);}} className="w-full flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 py-2 rounded text-sm text-gray-300 mt-2">
            <Search className="w-4 h-4" /> <span>Join Server</span>
          </button>
        )}
        {currentServer && (
           <div className="mt-4 text-xs text-gray-500 text-center">
             Current Server ID: {currentServer.id}
           </div>
        )}
      </div>
    </div>
  );
}