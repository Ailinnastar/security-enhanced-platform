import { useState, useEffect } from 'react';
import axios from 'axios';
import { Video, Plus } from 'lucide-react';

export default function VideoSummary({ currentServer, token }) {
  const [summaries, setSummaries] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchSummaries();
  }, [currentServer, token]);

  const fetchSummaries = async () => {
    try {
      const res = await axios.get(`http://localhost:3002/api/servers/${currentServer.id}/video-summaries`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummaries(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`http://localhost:3002/api/servers/${currentServer.id}/video-summaries`, 
        { title, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTitle('');
      setContent('');
      setIsCreating(false);
      fetchSummaries();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Video className="w-6 h-6 mr-2 text-indigo-600" /> Video Call Summaries
        </h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center hover:bg-indigo-700"
        >
          {isCreating ? 'Cancel' : <><Plus className="w-4 h-4 mr-1" /> New Summary</>}
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-8">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title / Date</label>
              <input 
                type="text" required value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500" 
                placeholder="Weekly Sync - Oct 25"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AI Summary Notes (or manual)</label>
              <textarea 
                required value={content} onChange={e => setContent(e.target.value)} rows="5"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500" 
                placeholder="Discussed project milestones..."
              />
            </div>
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full">
              Save Summary
            </button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {summaries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No video summaries yet.</p>
        ) : (
          summaries.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold text-gray-800">{s.title}</h4>
                <span className="text-xs text-gray-500">{new Date(s.date).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{s.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}