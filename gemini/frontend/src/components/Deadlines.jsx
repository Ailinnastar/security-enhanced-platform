import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';

export default function Deadlines({ currentServer, token }) {
  const [deadlines, setDeadlines] = useState([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    fetchDeadlines();
  }, [currentServer, token]);

  const fetchDeadlines = async () => {
    try {
      const res = await axios.get(`http://localhost:3002/api/servers/${currentServer.id}/deadlines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeadlines(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`http://localhost:3002/api/servers/${currentServer.id}/deadlines`, 
        { title, due_date: dueDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTitle('');
      setDueDate('');
      fetchDeadlines();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
        <CalendarIcon className="w-6 h-6 mr-2 text-indigo-600" /> Deadlines
      </h2>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h3 className="text-lg font-semibold mb-4">Add New Deadline</h3>
        <form onSubmit={handleAdd} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Task / Title</label>
            <input 
              type="text" required value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500" 
              placeholder="e.g., Final Report Submission"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input 
              type="datetime-local" required value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500" 
            />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-1" /> Add
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {deadlines.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No deadlines set for this server.</p>
        ) : (
          deadlines.map(d => (
            <div key={d.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-gray-800">{d.title}</h4>
                <p className="text-sm text-gray-500">Due: {new Date(d.due_date).toLocaleString()}</p>
              </div>
              {new Date(d.due_date) < new Date() ? (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Overdue</span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Upcoming</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}