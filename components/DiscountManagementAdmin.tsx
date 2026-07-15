import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  getAllCoupons, 
  createCoupon, 
  updateCoupon, 
  deleteCoupon, 
  bulkGenerateCoupons, 
  getDiscountAnalytics, 
  getCouponUsageHistory,
  getDiscountAuditLogs
} from '../services/discountService';
import { DiscountMaster, UserDiscountUsage, DiscountAnalytics } from '../types';
import { useLanguage } from './LanguageContext';

interface DiscountManagementAdminProps {
  currentUser: any;
}

export const DiscountManagementAdmin: React.FC<DiscountManagementAdminProps> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'bulk' | 'history' | 'audit' | 'analytics'>('list');
  
  // Data States
  const [coupons, setCoupons] = useState<DiscountMaster[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<DiscountAnalytics | null>(null);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCustomerType, setFilterCustomerType] = useState('ALL');
  const [filterDiscountType, setFilterDiscountType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Manual Coupon Creation/Edit Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<DiscountMaster | null>(null);
  const [formData, setFormData] = useState({
    coupon_code: '',
    customer_type: 'GENERAL',
    discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FREE_MONTHS' | 'FREE_ACCESS',
    discount_value: 0,
    description: '',
    max_usage: 1000,
    start_date: new Date().toISOString().substring(0, 16),
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
    is_active: true
  });

  // Bulk Generation States
  const [bulkData, setBulkData] = useState({
    customer_type: 'Student',
    prefix: 'STU',
    quantity: 10,
    discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FREE_MONTHS' | 'FREE_ACCESS',
    discount_value: 50,
    max_usage: 1,
    start_date: new Date().toISOString().substring(0, 16),
    end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
    description: ''
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'list') {
        const data = await getAllCoupons();
        setCoupons(data);
      } else if (activeSubTab === 'history') {
        const data = await getCouponUsageHistory();
        setHistory(data);
      } else if (activeSubTab === 'audit') {
        const data = await getDiscountAuditLogs();
        setAuditLogs(data);
      } else if (activeSubTab === 'analytics') {
        const data = await getDiscountAnalytics();
        setAnalytics(data);
      }
    } catch (err: any) {
      console.error(err);
      showMsg(err.message || 'Failed to fetch discount records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const handleOpenCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      coupon_code: '',
      customer_type: 'GENERAL',
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      description: '',
      max_usage: 1000,
      start_date: new Date().toISOString().substring(0, 16),
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 16),
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (coupon: DiscountMaster) => {
    setEditingCoupon(coupon);
    setFormData({
      coupon_code: coupon.coupon_code,
      customer_type: coupon.display_name || coupon.customer_type,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      description: coupon.description || '',
      max_usage: coupon.max_usage,
      start_date: coupon.start_date ? new Date(coupon.start_date).toISOString().substring(0, 16) : '',
      end_date: coupon.end_date ? new Date(coupon.end_date).toISOString().substring(0, 16) : '',
      is_active: coupon.is_active
    });
    setIsModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.coupon_code.trim()) return showMsg('Coupon code is required', 'error');
    setActionLoading(true);

    try {
      const formatted = {
        customer_type: 'GENERAL',
        display_name: formData.customer_type,
        coupon_code: formData.coupon_code.trim().toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: Number(formData.discount_value),
        description: formData.description,
        max_usage: Number(formData.max_usage),
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        is_active: formData.is_active,
        created_by: currentUser?.id
      };

      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, formatted, currentUser?.id);
        showMsg('Coupon updated successfully');
      } else {
        await createCoupon(formatted, currentUser?.id);
        showMsg('Coupon created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      if (err.code === '23505') {
        showMsg('Coupon code already exists!', 'error');
      } else {
        showMsg(err.message || 'Failed to save coupon.', 'error');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (coupon: DiscountMaster) => {
    setActionLoading(true);
    try {
      await updateCoupon(coupon.id, { is_active: !coupon.is_active }, currentUser?.id);
      showMsg(`Coupon ${coupon.is_active ? 'disabled' : 'activated'} successfully`);
      fetchData();
    } catch (err: any) {
      showMsg(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCoupon = async (coupon: DiscountMaster) => {
    if (!window.confirm(`Are you sure you want to delete coupon ${coupon.coupon_code}?`)) return;
    setActionLoading(true);
    try {
      await deleteCoupon(coupon.id, coupon.coupon_code, currentUser?.id);
      showMsg('Coupon deleted successfully');
      fetchData();
    } catch (err: any) {
      showMsg(err.message || 'Delete failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloneCoupon = (coupon: DiscountMaster) => {
    setEditingCoupon(null);
    setFormData({
      coupon_code: `${coupon.coupon_code}_CLONE`,
      customer_type: coupon.customer_type,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      description: coupon.description || '',
      max_usage: coupon.max_usage,
      start_date: new Date().toISOString().substring(0, 16),
      end_date: coupon.end_date ? new Date(coupon.end_date).toISOString().substring(0, 16) : '',
      is_active: coupon.is_active
    });
    setIsModalOpen(true);
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkData.prefix.trim()) return showMsg('Prefix is required', 'error');
    if (bulkData.quantity <= 0 || bulkData.quantity > 5000) return showMsg('Quantity must be between 1 and 5000', 'error');
    
    setActionLoading(true);
    try {
      const inserted = await bulkGenerateCoupons({
        customerType: 'GENERAL',
        displayName: bulkData.customer_type,
        prefix: bulkData.prefix.toUpperCase(),
        quantity: Number(bulkData.quantity),
        discountType: bulkData.discount_type,
        discountValue: Number(bulkData.discount_value),
        maxUsage: Number(bulkData.max_usage),
        startDate: bulkData.start_date ? new Date(bulkData.start_date).toISOString() : undefined,
        endDate: bulkData.end_date ? new Date(bulkData.end_date).toISOString() : undefined,
        description: bulkData.description || `Bulk generated ${bulkData.display_name} Coupons`
      }, currentUser?.id);

      showMsg(`Successfully bulk generated ${inserted.length} coupons!`);
      setActiveSubTab('list');
    } catch (err: any) {
      showMsg(err.message || 'Bulk generation failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ['ID', 'Customer Type', 'Coupon Code', 'Discount Type', 'Discount Value', 'Active', 'Max Usage', 'Current Usage', 'Start Date', 'End Date'];
      const rows = coupons.map(c => [
        c.id,
        c.display_name || c.customer_type,
        c.coupon_code,
        c.discount_type,
        c.discount_value,
        c.is_active ? 'YES' : 'NO',
        c.max_usage,
        c.current_usage,
        c.start_date || '',
        c.end_date || ''
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Simplish_Coupons_${new Date().toISOString().substring(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('CSV Export failed');
    }
  };

  // Filtered Coupon List
  const filteredCoupons = coupons.filter(c => {
    const matchesSearch = c.coupon_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCustType = filterCustomerType === 'ALL' || (c.display_name || c.customer_type) === filterCustomerType || c.customer_type === filterCustomerType;
    const matchesDiscType = filterDiscountType === 'ALL' || c.discount_type === filterDiscountType;
    
    let matchesStatus = true;
    if (filterStatus === 'ACTIVE') {
      const isExpired = c.end_date && new Date(c.end_date) < new Date();
      matchesStatus = c.is_active && !isExpired;
    } else if (filterStatus === 'INACTIVE') {
      matchesStatus = !c.is_active;
    } else if (filterStatus === 'EXPIRED') {
      matchesStatus = !!(c.end_date && new Date(c.end_date) < new Date());
    }

    return matchesSearch && matchesCustType && matchesDiscType && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-slate-800 dark:text-slate-100">
      
      {/* Sub tabs navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-100 dark:border-slate-800">
        {[
          { id: 'list', label: 'All Coupons', icon: '🎟️' },
          { id: 'bulk', label: 'Bulk Generator', icon: '⚡' },
          { id: 'history', label: 'Usage History', icon: '🧾' },
          { id: 'audit', label: 'Audit Trail', icon: '🛡️' },
          { id: 'analytics', label: 'Reports & Analytics', icon: '📊' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === tab.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Global alert messages */}
      {message && (
        <div className={`p-4 rounded-2xl font-bold text-xs animate-pulse ${
          message.type === 'success' ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30'
        }`}>
          {message.type === 'success' ? '✅' : '⚠️'} {message.text}
        </div>
      )}

      {/* TAB CONTENT: COUPON LIST */}
      {activeSubTab === 'list' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-md flex flex-wrap gap-4 justify-between items-center">
            
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center flex-1 min-w-[300px]">
              <input
                type="text"
                placeholder="Search Coupon Code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-60"
              />

              <select
                value={filterCustomerType}
                onChange={e => setFilterCustomerType(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Customer Type: All</option>
                <option value="GENERAL">General</option>
                <option value="Student">Student</option>
                <option value="Beta Users">Beta Users</option>
                <option value="Institutions">Institutions</option>
                <option value="Rural Karnataka Program">Rural Program</option>
                <option value="Ambassadors">Ambassadors/Moderators</option>
              </select>

              <select
                value={filterDiscountType}
                onChange={e => setFilterDiscountType(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Discount Type: All</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FREE_MONTHS">Free Months</option>
                <option value="FREE_ACCESS">Free Access</option>
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Status: All</option>
                <option value="ACTIVE">Active & Unexpired</option>
                <option value="INACTIVE">Disabled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
              >
                📥 Export CSV
              </button>
              <button
                onClick={handleOpenCreateModal}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md"
              >
                ➕ Create Coupon
              </button>
            </div>

          </div>

          {/* Grid Layout */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-[2rem] border-2 border-slate-100 dark:border-slate-800">
              <span className="text-4xl">📭</span>
              <p className="font-black text-slate-400 uppercase tracking-widest mt-4">No coupons matching selected criteria.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-850 text-slate-400 text-[9px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4">Customer Type</th>
                      <th className="px-6 py-4">Coupon Code</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Value</th>
                      <th className="px-6 py-4">Usage Limits</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredCoupons.map(coupon => {
                      const percentUsed = Math.min(100, Math.round((coupon.current_usage / Math.max(1, coupon.max_usage)) * 100));
                      const isExpired = coupon.end_date && new Date(coupon.end_date) < new Date();
                      const statusClass = (coupon.is_active && !isExpired) 
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' 
                        : isExpired 
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400';
                      
                      const statusText = (coupon.is_active && !isExpired) 
                        ? 'Active' 
                        : isExpired 
                          ? 'Expired'
                          : 'Disabled';

                      return (
                        <tr key={coupon.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-6 py-4">
                            <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{coupon.display_name || coupon.customer_type}</span>
                            {coupon.description && <span className="block text-[10px] text-slate-400 italic mt-0.5">{coupon.description}</span>}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-blue-600 dark:text-blue-400 select-all">
                            {coupon.coupon_code}
                          </td>
                          <td className="px-6 py-4 font-black uppercase text-[10px]">
                            {coupon.discount_type.replace('_', ' ')}
                          </td>
                          <td className="px-6 py-4 font-bold">
                            {coupon.discount_type === 'PERCENTAGE' ? `${coupon.discount_value}%` : 
                             coupon.discount_type === 'FREE_MONTHS' ? `+${coupon.discount_value} Mon` : 'Free'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-between gap-4 w-40">
                              <span className="font-bold whitespace-nowrap">{coupon.current_usage} / {coupon.max_usage}</span>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${percentUsed > 80 ? 'bg-red-500' : 'bg-blue-600'}`} 
                                  style={{ width: `${percentUsed}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold">{percentUsed}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusClass}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleToggleActive(coupon)}
                                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                  coupon.is_active
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                                    : 'bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-950/20 dark:hover:bg-green-950/40 dark:text-green-400'
                                }`}
                              >
                                {coupon.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(coupon)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-blue-600 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleCloneCoupon(coupon)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-amber-600 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest"
                              >
                                Clone
                              </button>
                              <button
                                onClick={() => handleDeleteCoupon(coupon)}
                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-lg text-[9px] font-black uppercase tracking-widest"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: BULK GENERATOR */}
      {activeSubTab === 'bulk' && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-3xl bg-blue-50 dark:bg-blue-900/30 p-3.5 rounded-2xl">⚡</span>
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tight">Bulk Coupon Generator</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Generate up to 5000 unique, secure codes instantly</p>
            </div>
          </div>

          <form onSubmit={handleBulkGenerate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Type Group</label>
              <select
                value={bulkData.customer_type}
                onChange={e => {
                  let pref = 'GEN';
                  if (e.target.value === 'Student') pref = 'STU';
                  else if (e.target.value === 'Beta Users') pref = 'BETA';
                  else if (e.target.value === 'Institutions') pref = 'INST';
                  else if (e.target.value === 'Rural Karnataka Program') pref = 'RUR';
                  else if (e.target.value === 'Ambassadors') pref = 'AMB';
                  setBulkData({ ...bulkData, customer_type: e.target.value, prefix: pref });
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Student">Student (STU)</option>
                <option value="Beta Users">Beta Users (BETA)</option>
                <option value="Institutions">Institutions (INST)</option>
                <option value="Rural Karnataka Program">Rural Program (RUR)</option>
                <option value="Ambassadors">Ambassadors/Moderators (AMB)</option>
                <option value="GENERAL">General/Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coupon Code Prefix</label>
              <input
                type="text"
                value={bulkData.prefix}
                onChange={e => setBulkData({ ...bulkData, prefix: e.target.value.substring(0, 10).toUpperCase() })}
                maxLength={10}
                placeholder="e.g. STU"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
              <p className="text-[9px] text-slate-400 font-bold italic uppercase">Output: e.g. {bulkData.prefix || 'PREFIX'}-A9X2J-P4KL</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
              <input
                type="number"
                value={bulkData.quantity}
                onChange={e => setBulkData({ ...bulkData, quantity: Math.max(1, Math.min(5000, Number(e.target.value))) })}
                min={1}
                max={5000}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max Usage (Per Coupon)</label>
              <input
                type="number"
                value={bulkData.max_usage}
                onChange={e => setBulkData({ ...bulkData, max_usage: Math.max(1, Number(e.target.value)) })}
                min={1}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-[9px] text-slate-400 font-bold italic uppercase">Typically 1 for single-use personalized codes</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount Type</label>
              <select
                value={bulkData.discount_type}
                onChange={e => setBulkData({ ...bulkData, discount_type: e.target.value as any, discount_value: e.target.value === 'FREE_ACCESS' ? 100 : e.target.value === 'FREE_MONTHS' ? 1 : 50 })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PERCENTAGE">PERCENTAGE (%)</option>
                <option value="FREE_MONTHS">FREE MONTHS (Duration Extension)</option>
                <option value="FREE_ACCESS">FREE ACCESS (₹0 Full Upgrade)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount Value</label>
              <input
                type="number"
                value={bulkData.discount_value}
                onChange={e => setBulkData({ ...bulkData, discount_value: Math.max(0, Number(e.target.value)) })}
                disabled={bulkData.discount_type === 'FREE_ACCESS'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                required
              />
              <p className="text-[9px] text-slate-400 font-bold italic uppercase">
                {bulkData.discount_type === 'PERCENTAGE' ? 'Discount Percentage (e.g. 50 = 50% Off)' :
                 bulkData.discount_type === 'FREE_MONTHS' ? 'Number of free months added (e.g. 1 = +1 Month)' : '100% discount full access'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
              <input
                type="datetime-local"
                value={bulkData.start_date}
                onChange={e => setBulkData({ ...bulkData, start_date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiry Date</label>
              <input
                type="datetime-local"
                value={bulkData.end_date}
                onChange={e => setBulkData({ ...bulkData, end_date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Memo / Notes</label>
              <textarea
                value={bulkData.description}
                onChange={e => setBulkData({ ...bulkData, description: e.target.value })}
                rows={2}
                placeholder="e.g. Generated for Rural Karnataka Digital Literacy Campaign 2026..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            <div className="md:col-span-2 pt-4">
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 border-b-4 border-blue-800 disabled:opacity-50"
              >
                {actionLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '⚡'}
                Generate {bulkData.quantity} Coupons
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT: USAGE HISTORY */}
      {activeSubTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-3xl bg-blue-50 dark:bg-blue-900/30 p-3.5 rounded-2xl">🧾</span>
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tight">Coupon Usage History</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Real-time log of customer coupon redemptions</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : history.length === 0 ? (
            <p className="text-center font-bold text-slate-400 py-10 uppercase tracking-widest text-xs">No coupons have been applied yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850 text-slate-400 text-[9px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Coupon Code</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Price / Discounted / Paid</th>
                    <th className="px-6 py-4">Transaction Reference</th>
                    <th className="px-6 py-4 text-right">Used On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900 dark:text-white">{row.profiles?.full_name || 'Guest User'}</span>
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{row.profiles?.phone}</span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-blue-600 dark:text-blue-400">{row.coupon_code}</td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-black uppercase tracking-tight">{row.purchase_type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-400">₹{row.amount_before_discount}</span>
                        <span className="text-green-600 font-bold mx-1.5">-₹{row.discount_amount}</span>
                        <span className="font-black text-blue-600">₹{row.final_amount}</span>
                      </td>
                      <td className="px-6 py-4 font-mono select-all text-slate-500 dark:text-slate-400">{row.transaction_id}</td>
                      <td className="px-6 py-4 text-right text-slate-400 font-bold">
                        {new Date(row.used_on).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: AUDIT TRAIL */}
      {activeSubTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-3xl bg-blue-50 dark:bg-blue-900/30 p-3.5 rounded-2xl">🛡️</span>
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase tracking-tight">System Audit Log</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Administrative audit trail for coupon operations</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-center font-bold text-slate-400 py-10 uppercase tracking-widest text-xs">No audit logs found.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850 text-slate-400 text-[9px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Coupon Code</th>
                    <th className="px-6 py-4">Performed By</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.map(log => {
                    const actionClass = 
                      log.action === 'CREATE' ? 'bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400' :
                      log.action === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400' :
                      log.action === 'DISABLE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 font-bold">
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest ${actionClass}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-blue-600 dark:text-blue-400">{log.coupon_code}</td>
                        <td className="px-6 py-4">
                          <span className="text-slate-900 dark:text-white">{log.profiles?.full_name || 'System Admin'}</span>
                          <span className="block text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{log.profiles?.role}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                        <td className="px-6 py-4 max-w-xs truncate text-[10px] text-slate-500 font-mono">
                          {JSON.stringify(log.details)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 font-bold">
                          {new Date(log.created_at).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: ANALYTICS & REPORTS */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          {loading || !analytics ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Coupons Created</p>
                <p className="text-3xl font-black text-blue-600">{analytics.totalCreated}</p>
                <div className="mt-2 h-1 w-12 bg-blue-500 rounded-full"></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Times Used</p>
                <p className="text-3xl font-black text-orange-500">{analytics.totalUsed}</p>
                <div className="mt-2 h-1 w-12 bg-orange-500 rounded-full"></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue Lost (Discounts)</p>
                <p className="text-3xl font-black text-red-500">₹{analytics.revenueLost.toLocaleString('en-IN')}</p>
                <div className="mt-2 h-1 w-12 bg-red-500 rounded-full"></div>
              </div>

              <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-6 rounded-[2rem] shadow-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Revenue Generated</p>
                <p className="text-3xl font-black text-green-600">₹{analytics.revenueGenerated.toLocaleString('en-IN')}</p>
                <div className="mt-2 h-1 w-12 bg-green-500 rounded-full"></div>
              </div>

              {/* Conversion and details */}
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-8 rounded-[2rem] shadow-xl md:col-span-2">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Top Performing Coupons</h4>
                {analytics.topPerforming.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider py-4">No performance metrics yet.</p>
                ) : (
                  <div className="space-y-4">
                    {analytics.topPerforming.map((perf, index) => {
                      const share = Math.round((perf.count / Math.max(1, analytics.totalUsed)) * 100);
                      return (
                        <div key={perf.code} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="font-mono text-blue-600">{index + 1}. {perf.code}</span>
                            <span>{perf.count} times used (₹{perf.revenue.toLocaleString('en-IN')} net)</span>
                          </div>
                          <div className="w-full bg-slate-50 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${share}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-8 rounded-[2rem] shadow-xl md:col-span-2">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Redemption by Customer Type</h4>
                {analytics.customerDistribution.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider py-4">No distribution metrics yet.</p>
                ) : (
                  <div className="space-y-4">
                    {analytics.customerDistribution.map((dist, index) => {
                      const share = Math.round((dist.count / Math.max(1, analytics.totalUsed)) * 100);
                      return (
                        <div key={dist.type} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="uppercase tracking-tight text-slate-700 dark:text-slate-300">{index + 1}. {dist.type}</span>
                            <span>{dist.count} uses ({share}%)</span>
                          </div>
                          <div className="w-full bg-slate-50 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500" style={{ width: `${share}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {editingCoupon ? 'Modify coupon parameters' : 'Define manual coupon code'}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Coupon Code</label>
                <input
                  type="text"
                  value={formData.coupon_code}
                  onChange={e => setFormData({ ...formData, coupon_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. STUDENT50"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer Type Group</label>
                <select
                  value={formData.customer_type}
                  onChange={e => setFormData({ ...formData, customer_type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl font-bold text-xs"
                >
                  <option value="GENERAL">General / Public</option>
                  <option value="Student">Student</option>
                  <option value="Beta Users">Beta Users</option>
                  <option value="Institutions">Institutions</option>
                  <option value="Rural Karnataka Program">Rural Program</option>
                  <option value="Ambassadors">Ambassadors/Moderators</option>
                  <option value="School Bulk Purchase">School Bulk Purchase</option>
                  <option value="College Bulk Purchase">College Bulk Purchase</option>
                  <option value="Renewal Customers">Renewal Customers</option>
                  <option value="Launch Promotion">Launch Promotion</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Discount Type</label>
                <select
                  value={formData.discount_type}
                  onChange={e => setFormData({ 
                    ...formData, 
                    discount_type: e.target.value as any, 
                    discount_value: e.target.value === 'FREE_ACCESS' ? 100 : e.target.value === 'FREE_MONTHS' ? 1 : 10 
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl font-bold text-xs"
                >
                  <option value="PERCENTAGE">PERCENTAGE (%)</option>
                  <option value="FREE_MONTHS">FREE MONTHS (Duration Extension)</option>
                  <option value="FREE_ACCESS">FREE ACCESS (₹0 Full Upgrade)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Discount Value</label>
                <input
                  type="number"
                  value={formData.discount_value}
                  onChange={e => setFormData({ ...formData, discount_value: Math.max(0, Number(e.target.value)) })}
                  disabled={formData.discount_type === 'FREE_ACCESS'}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold disabled:opacity-50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Max Usage Limit</label>
                <input
                  type="number"
                  value={formData.max_usage}
                  onChange={e => setFormData({ ...formData, max_usage: Math.max(1, Number(e.target.value)) })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. 50% discount for Beta Launch..."
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Enable coupon immediately
                </label>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl border-b-4 border-blue-800 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {actionLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                Save Coupon
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
