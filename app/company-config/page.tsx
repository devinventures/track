"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FiSave, FiEdit, FiTrash2, FiPlus, FiUser, FiX } from 'react-icons/fi';

// Updated type for our unified table
type ConfigEntry = {
  id: string;
  user_id: string; // Changed from laborer_name
  labor_type: string;
  hourly_wage: number;
};

// Pre-defined labor types for the dropdown menu
const LABOR_TYPE_OPTIONS = ['Shelving', 'Packaging', 'Cleaning', 'Loading', 'Sorting', 'General'];

export default function CompanyConfigPage() {
  const [configEntries, setConfigEntries] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Updated form state
  const [formState, setFormState] = useState<Omit<ConfigEntry, 'id'>>({
    user_id: '',
    labor_type: LABOR_TYPE_OPTIONS[0],
    hourly_wage: 0,
  });

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      const { data, error } = await supabase.from('company_config').select('*').order('created_at');
      if (error) console.error('Error fetching company config:', error);
      else setConfigEntries(data || []);
      setLoading(false);
    }
    fetchConfig();
  }, []);

  const handleAddEntry = async () => {
    if (formState.user_id && formState.hourly_wage > 0) {
      const { data, error } = await supabase.from('company_config').insert(formState).select().single();
      if (error) console.error('Error adding entry:', error);
      else if (data) {
        setConfigEntries([...configEntries, data]);
        setFormState({ user_id: '', labor_type: LABOR_TYPE_OPTIONS[0], hourly_wage: 0 });
      }
    }
  };

  const handleEditEntry = (entry: ConfigEntry) => {
    setEditingEntryId(entry.id);
    setFormState({ user_id: entry.user_id, labor_type: entry.labor_type, hourly_wage: entry.hourly_wage });
  };
  
  const handleSaveEntry = async (id: string) => {
    const { data, error } = await supabase.from('company_config').update(formState).eq('id', id).select().single();
    if (error) console.error('Error updating entry:', error);
    else if (data) {
      setConfigEntries(configEntries.map(e => (e.id === id ? data : e)));
      setEditingEntryId(null);
      setFormState({ user_id: '', labor_type: LABOR_TYPE_OPTIONS[0], hourly_wage: 0 });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    const { error } = await supabase.from('company_config').delete().eq('id', id);
    if (error) console.error('Error deleting entry:', error);
    else setConfigEntries(configEntries.filter(e => e.id !== id));
  };

  if (loading) return <div className="p-8">Loading configuration...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Company Configuration</h1>
        <p className="text-gray-500">Manage laborer roles and wages by User ID.</p>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FiUser className="text-indigo-600" />
            Labor & Wage Management
          </h2>
          
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium mb-3">Add New Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <input type="text" value={formState.user_id} onChange={(e) => setFormState({ ...formState, user_id: e.target.value })} placeholder="Enter user UUID" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type of Labor</label>
                <select value={formState.labor_type} onChange={(e) => setFormState({ ...formState, labor_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  {LABOR_TYPE_OPTIONS.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Wage ($)</label>
                <input type="number" step="0.01" min="0" value={formState.hourly_wage} onChange={(e) => setFormState({ ...formState, hourly_wage: parseFloat(e.target.value) || 0 })} placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <button onClick={handleAddEntry} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center justify-center gap-2"><FiPlus />Add Entry</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <h3 className="text-lg font-medium mb-2">Current Configuration</h3>
            <table className="min-w-full bg-white rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type of Labor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hourly Wage</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {configEntries.map((entry) => (
                  <tr key={entry.id}>
                    {editingEntryId === entry.id ? (
                      <>
                        <td className="px-6 py-4"><input type="text" value={formState.user_id} onChange={(e) => setFormState({ ...formState, user_id: e.target.value })} className="border-gray-300 rounded-md shadow-sm w-full" /></td>
                        <td className="px-6 py-4">
                          <select value={formState.labor_type} onChange={(e) => setFormState({ ...formState, labor_type: e.target.value })} className="border-gray-300 rounded-md shadow-sm w-full">
                            {LABOR_TYPE_OPTIONS.map(type => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4"><input type="number" step="0.01" min="0" value={formState.hourly_wage} onChange={(e) => setFormState({ ...formState, hourly_wage: parseFloat(e.target.value) || 0 })} className="border-gray-300 rounded-md shadow-sm w-full" /></td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleSaveEntry(entry.id)} className="p-2 text-green-600 hover:text-green-700"><FiSave size={20} /></button>
                          <button onClick={() => setEditingEntryId(null)} className="p-2 text-gray-500 hover:text-gray-700 ml-2"><FiX size={20} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">{entry.user_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{entry.labor_type}</td>
                        <td className="px-6 py-4 whitespace-nowrap">${entry.hourly_wage.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button onClick={() => handleEditEntry(entry)} className="p-2 text-gray-500 hover:text-indigo-600"><FiEdit /></button>
                          <button onClick={() => handleDeleteEntry(entry.id)} className="p-2 text-red-500 hover:text-red-600 ml-2"><FiTrash2 /></button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {configEntries.length === 0 && !loading && (<div className="text-center py-8 text-gray-500 border-t">No configuration entries yet. Add your first one above.</div>)}
          </div>
        </section>
      </main>
    </div>
  );
}