import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Trash2, Award, Clock, ArrowRight, Check } from 'lucide-react';
import { User as UserType, AnalysisHistoryItem } from '../types';
import { updateUserProfile, fetchUserHistory, deleteUserHistory } from '../services/api';

interface UserProfilePageProps {
  user: UserType;
  onUpdateUser: (u: UserType) => void;
  onSelectAnalysis: (analysisId: string) => void;
  onLogout: () => void;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  user,
  onUpdateUser,
  onSelectAnalysis,
  onLogout,
}) => {
  const [fullName, setFullName] = useState(user.full_name);
  const [mobile, setMobile] = useState(user.mobile || '');
  const [avatarColor, setAvatarColor] = useState(user.avatar_color || '#14B8A6');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchUserHistory()
      .then((items) => {
        setHistoryItems(items);
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await updateUserProfile({
        full_name: fullName,
        mobile: mobile || undefined,
        avatar_color: avatarColor,
      });
      onUpdateUser(updated);
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setIsSaving(false);
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this speech evaluation record?')) return;
    try {
      await deleteUserHistory(id);
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      alert('Failed to delete history record.');
    }
  };

  const colors = ['#14B8A6', '#0284C7', '#6366F1', '#EC4899', '#F59E0B', '#10B981'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Profile Header */}
      <div className="white-card p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-soft-sm shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{user.full_name}</h1>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{user.email}</span> &bull; 
              <span>Member since {new Date(user.created_at).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Profile Settings (5 cols) */}
        <div className="lg:col-span-5 white-card p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">Edit Profile Information</h2>

          {saveSuccess && (
            <div className="mb-4 p-3 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-teal-600" /> Profile saved successfully!
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Avatar Theme Color
              </label>
              <div className="flex items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      avatarColor === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full mt-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-soft-teal transition-all"
            >
              {isSaving ? 'Saving...' : 'Update Profile'}
            </button>
          </form>
        </div>

        {/* Speech Evaluation History (7 cols) */}
        <div className="lg:col-span-7 white-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" /> Speech Evaluation History
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {historyItems.length} recordings
            </span>
          </div>

          {loadingHistory ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading history records...</div>
          ) : historyItems.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-xl border border-slate-200">
              <Award className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700 mb-0.5">No Speech History Yet</h4>
              <p className="text-xs text-slate-500">
                Complete your first practice session to see historical scores here!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectAnalysis(item.id)}
                  className="p-3.5 bg-slate-50 hover:bg-teal-50/70 border border-slate-200 hover:border-teal-200 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-sm text-slate-900 group-hover:border-teal-300">
                      {Math.round(item.total_score)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 capitalize">
                        {item.preset_used.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString()} &bull; {item.analysis_type}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteHistory(item.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
