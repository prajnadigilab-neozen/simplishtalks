import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadVisualContent, getOptimizedImageUrl } from '../services/visualContentService';
import { VisualContentCategory, VisualAccessLevel, VisualContent } from '../types';
import { getSystemConfig, updateSystemConfig } from '../services/systemConfigService';

export const VisualContentAdmin: React.FC = () => {
  const [items, setItems] = useState<VisualContent[]>([]);
  const [systemCategories, setSystemCategories] = useState<string[]>(['jokes', 'fun_facts', 'describe_image', 'identify_image', 'complete_sentence']);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<VisualContentCategory>('jokes');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [accessLevel, setAccessLevel] = useState<VisualAccessLevel>('free');
  const [expectedAnswer, setExpectedAnswer] = useState('');
  
  // Category Management State
  const [newCatName, setNewCatName] = useState('');
  const [isUpdatingCats, setIsUpdatingCats] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase.from('visual_content').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setItems(data as VisualContent[]);
    setLoading(false);
  };

  const loadSystemCategories = async () => {
    const config = await getSystemConfig();
    if (config?.visual_categories && Array.isArray(config.visual_categories)) {
      setSystemCategories(config.visual_categories);
      setCategory(config.visual_categories[0] || 'jokes');
    }
  };

  useEffect(() => {
    fetchItems();
    loadSystemCategories();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName || systemCategories.includes(newCatName)) return;
    setIsUpdatingCats(true);
    const updated = [...systemCategories, newCatName];
    const { data: { user } } = await supabase.auth.getUser();
    const res = await updateSystemConfig({ visual_categories: updated }, user?.id || '');
    if (res.success) {
      setSystemCategories(updated);
      setNewCatName('');
    } else {
      alert('Error saving category: ' + res.error);
    }
    setIsUpdatingCats(false);
  };

  const handleRemoveCategory = async (catToRemove: string) => {
    if (!window.confirm(`Are you sure you want to remove "${catToRemove}" from the preset dropdown? Existing uploads with this category will not be altered.`)) return;
    setIsUpdatingCats(true);
    const updated = systemCategories.filter(c => c !== catToRemove);
    const { data: { user } } = await supabase.auth.getUser();
    const res = await updateSystemConfig({ visual_categories: updated }, user?.id || '');
    if (res.success) {
      setSystemCategories(updated);
      if (category === catToRemove) setCategory(updated[0] || '');
    } else {
      alert('Error removing category: ' + res.error);
    }
    setIsUpdatingCats(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Please select an image file');
    setUploading(true);
    try {
      const metadata: any = {};
      if (category === 'complete_sentence' || expectedAnswer) {
        metadata.expected_answer = expectedAnswer;
      }
      
      const newItem = await uploadVisualContent(file, {
        caption,
        category,
        access_level: accessLevel,
        metadata
      });
      
      setItems([newItem, ...items]);
      
      setFile(null);
      setCaption('');
      setExpectedAnswer('');
      setIsCustomCategory(false);
      setCategory(systemCategories[0] || 'jokes');
      alert('Upload successful');
    } catch (err: any) {
      alert(`Error uploading: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, image_url: string) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await supabase.from('visual_content').delete().eq('id', id);
      await supabase.storage.from('visual-content').remove([image_url]);
      setItems(items.filter(item => item.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-xl">
        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Upload Visual Content</h3>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400">Image File</label>
            <input 
              type="file" accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700" 
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
            {!isCustomCategory ? (
              <select 
                value={category} 
                onChange={(e) => {
                  if (e.target.value === 'CUSTOM') {
                    setIsCustomCategory(true);
                    setCategory('');
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
              >
                {systemCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
                <option value="CUSTOM" className="font-bold text-blue-600 dark:text-blue-400">Custom...</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="e.g. daily_vocab"
                  className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => { setIsCustomCategory(false); setCategory(systemCategories[0] || 'jokes'); }} 
                  className="px-4 py-3 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  CANCEL
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400">Access Level</label>
            <select 
              value={accessLevel} 
              onChange={(e) => setAccessLevel(e.target.value as VisualAccessLevel)}
              className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
            >
              <option value="free">Free (All Users)</option>
              <option value="premium">Premium (Subscribers only)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400">Caption (Optional)</label>
            <input 
              type="text" 
              value={caption} 
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Enter caption..."
              className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700" 
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase text-slate-400">Expected Answer (For Fill in the Blanks)</label>
            <input 
              type="text" 
              value={expectedAnswer} 
              onChange={(e) => setExpectedAnswer(e.target.value)}
              placeholder="Leave blank if not 'Complete Sentence'..."
              className="w-full bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700" 
            />
          </div>

          <div className="md:col-span-2 pt-4">
            <button 
              type="submit" 
              disabled={uploading || !file || !category}
              className="px-8 py-4 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-xl">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest">Manage Categories</h3>
        
        <div className="flex flex-wrap gap-3 mb-6">
          {systemCategories.map(cat => (
            <div key={cat} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{cat.replace(/_/g, ' ')}</span>
              {systemCategories.length > 1 && (
                <button type="button" disabled={isUpdatingCats} onClick={() => handleRemoveCategory(cat)} className="text-slate-400 hover:text-rose-500 w-5 h-5 flex items-center justify-center rounded-full hover:bg-rose-50 dark:hover:bg-rose-900 transition-colors">×</button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAddCategory} className="flex flex-col md:flex-row gap-4 mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
          <input 
             type="text" 
             value={newCatName}
             onChange={e => setNewCatName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
             placeholder="new_category_name" 
             className="w-full md:flex-1 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm"
             required
          />
          <button disabled={isUpdatingCats || !newCatName} type="submit" className="md:whitespace-nowrap px-6 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50">
            {isUpdatingCats ? '...' : '+ Add Preset'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-xl overflow-hidden">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest">Recent Content</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map(item => (
            <div key={item.id} className="relative group border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden aspect-square bg-slate-50 dark:bg-slate-800">
              <img src={getOptimizedImageUrl(item.image_url, 300)} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center text-white">
                <span className="text-[9px] font-black uppercase tracking-widest mb-1">{item.category.replace(/_/g, ' ')}</span>
                <span className="text-[9px] text-slate-300 font-bold mb-3">{item.access_level}</span>
                <button onClick={() => handleDelete(item.id, item.image_url)} className="px-3 py-1 bg-rose-600 rounded-lg text-xs font-black uppercase">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
