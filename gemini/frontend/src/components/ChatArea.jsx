import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Pin } from 'lucide-react';

export default function ChatArea({ currentServer, socket, token, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
  }, [currentServer, token]);

  useEffect(() => {
    if (socket) {
      socket.on('new_message', (msg) => {
        if (msg.server_id === currentServer.id) {
          setMessages((prev) => [...prev, msg]);
        }
      });
      socket.on('message_pinned', ({ messageId, isPinned }) => {
        setMessages((prev) => 
          prev.map(m => m.id === messageId ? { ...m, is_pinned: isPinned ? 1 : 0 } : m)
        );
      });
    }
    return () => {
      if (socket) {
        socket.off('new_message');
        socket.off('message_pinned');
      }
    };
  }, [socket, currentServer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`http://localhost:3002/api/servers/${currentServer.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;
    
    socket.emit('send_message', {
      serverId: currentServer.id,
      userId: user.id,
      username: user.username,
      content: newMessage
    });
    setNewMessage('');
  };

  const handlePin = (msgId, currentPinStatus) => {
    if (!socket) return;
    socket.emit('pin_message', {
      serverId: currentServer.id,
      messageId: msgId,
      isPinned: !currentPinStatus
    });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.is_pinned ? 'bg-yellow-50 p-2 rounded-lg border border-yellow-200' : ''}`}>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-gray-800">{msg.username}</span>
              <span className="text-xs text-gray-500">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button 
                onClick={() => handlePin(msg.id, msg.is_pinned)} 
                className={`ml-auto ${msg.is_pinned ? 'text-yellow-500' : 'text-gray-300 hover:text-gray-500'}`}
                title={msg.is_pinned ? "Unpin message" : "Pin message"}
              >
                <Pin className="w-4 h-4" />
              </button>
            </div>
            <p className="text-gray-700 mt-1 whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <form onSubmit={handleSend} className="flex space-x-2">
          <input
            type="text"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder={`Message # ${currentServer.name}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button 
            type="submit" 
            className="bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 focus:outline-none"
            disabled={!newMessage.trim()}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}