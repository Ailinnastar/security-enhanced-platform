import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart2, Plus } from 'lucide-react';

export default function Polls({ currentServer, token }) {
  const [polls, setPolls] = useState([]);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  useEffect(() => {
    fetchPolls();
  }, [currentServer, token]);

  const fetchPolls = async () => {
    try {
      const res = await axios.get(`http://localhost:3002/api/servers/${currentServer.id}/polls`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPolls(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddOption = () => setOptions([...options, '']);
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim() !== '');
    if (validOptions.length < 2) return alert('Provide at least 2 options');

    try {
      await axios.post(`http://localhost:3002/api/servers/${currentServer.id}/polls`, 
        { question, options: validOptions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuestion('');
      setOptions(['', '']);
      fetchPolls();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
        <BarChart2 className="w-6 h-6 mr-2 text-indigo-600" /> Group Polls
      </h2>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h3 className="text-lg font-semibold mb-4">Create a New Poll</h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
            <input 
              type="text" required value={question} onChange={e => setQuestion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500" 
              placeholder="What should we discuss next meeting?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
            {options.map((opt, i) => (
              <input 
                key={i} type="text" value={opt} onChange={e => handleOptionChange(i, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded mb-2 focus:ring-indigo-500" 
                placeholder={`Option ${i + 1}`} required={i < 2}
              />
            ))}
            <button type="button" onClick={handleAddOption} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center mt-1">
              <Plus className="w-4 h-4 mr-1" /> Add Option
            </button>
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center hover:bg-indigo-700 w-full justify-center">
            Create Poll
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {polls.length === 0 ? (
          <p className="text-gray-500 col-span-2 text-center py-4">No polls available.</p>
        ) : (
          polls.map(p => (
            <div key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-3">{p.question}</h4>
              <div className="space-y-2">
                {p.options.map((opt, i) => (
                  <div key={i} className="bg-gray-50 px-3 py-2 rounded border border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-100">
                    <span className="text-sm text-gray-700">{opt}</span>
                    <span className="text-xs text-gray-400">0 votes</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}