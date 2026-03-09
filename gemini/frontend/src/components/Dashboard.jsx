import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import ServerList from './ServerList';
import ChatArea from './ChatArea';
import Deadlines from './Deadlines';
import Polls from './Polls';
import VideoSummary from './VideoSummary';
import { LogOut, MessageSquare, Calendar, BarChart2, Video } from 'lucide-react';

export default function Dashboard({ token, setToken }) {
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [socket, setSocket] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // chat, deadlines, polls, videos

  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const newSocket = io('http://localhost:3002');
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  useEffect(() => {
    fetchServers();
  }, [token]);

  useEffect(() => {
    if (socket && currentServer) {
      socket.emit('join_server', currentServer.id);
    }
  }, [socket, currentServer]);

  const fetchServers = async () => {
    try {
      const res = await axios.get('http://localhost:3002/api/servers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(res.data);
      if (res.data.length > 0 && !currentServer) {
        setCurrentServer(res.data[0]);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar: Servers */}
      <ServerList 
        servers={servers} 
        currentServer={currentServer} 
        setCurrentServer={setCurrentServer} 
        fetchServers={fetchServers}
        token={token}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 p-4 flex justify-between items-center">
          <div className="font-semibold text-lg text-gray-800">
            {currentServer ? `# ${currentServer.name}` : 'Select or Create a Server'}
          </div>
          
          <div className="flex items-center space-x-4">
            {currentServer && (
              <div className="flex bg-gray-100 rounded-lg p-1 space-x-1">
                <button onClick={() => setActiveTab('chat')} className={`p-2 rounded ${activeTab === 'chat' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:bg-gray-200'}`} title="Chat">
                  <MessageSquare className="w-5 h-5" />
                </button>
                <button onClick={() => setActiveTab('deadlines')} className={`p-2 rounded ${activeTab === 'deadlines' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:bg-gray-200'}`} title="Deadlines">
                  <Calendar className="w-5 h-5" />
                </button>
                <button onClick={() => setActiveTab('polls')} className={`p-2 rounded ${activeTab === 'polls' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:bg-gray-200'}`} title="Polls">
                  <BarChart2 className="w-5 h-5" />
                </button>
                <button onClick={() => setActiveTab('videos')} className={`p-2 rounded ${activeTab === 'videos' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:bg-gray-200'}`} title="Video Summaries">
                  <Video className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="text-sm font-medium text-gray-700 flex items-center">
              <span className="mr-3">{user?.username}</span>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-500" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Area based on Active Tab */}
        <main className="flex-1 overflow-hidden relative">
          {!currentServer ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              Create or join a server to start collaborating.
            </div>
          ) : (
            <>
              {activeTab === 'chat' && <ChatArea currentServer={currentServer} socket={socket} token={token} user={user} />}
              {activeTab === 'deadlines' && <Deadlines currentServer={currentServer} token={token} />}
              {activeTab === 'polls' && <Polls currentServer={currentServer} token={token} />}
              {activeTab === 'videos' && <VideoSummary currentServer={currentServer} token={token} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}