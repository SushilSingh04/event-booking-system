import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarCog, ShieldCheck } from 'lucide-react';

const AdminNav = () => {
  const getTabClass = ({ isActive }) =>
    `inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
      isActive
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
    }`;

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-none">
              Admin Portal
            </h2>
            <span className="text-xs text-slate-500">
              System management & business intelligence
            </span>
          </div>
        </div>

        {/* Tab links */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <NavLink to="/admin" end className={getTabClass}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard & Analytics
          </NavLink>
          <NavLink to="/admin/events" className={getTabClass}>
            <CalendarCog className="w-4 h-4" />
            Event Management
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default AdminNav;
