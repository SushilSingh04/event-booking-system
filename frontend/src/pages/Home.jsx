import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Server,
  Zap,
} from 'lucide-react';

const Home = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [backendStatus, setBackendStatus] = useState({ checking: true, ok: false, message: '' });

  useEffect(() => {
    let isMounted = true;
    client
      .get('/health')
      .then((res) => {
        if (isMounted) {
          setBackendStatus({
            checking: false,
            ok: res.data?.status === 'healthy',
            message: `Connected to FastAPI (${res.data?.environment || 'development'})`,
          });
        }
      })
      .catch((err) => {
        if (isMounted) {
          setBackendStatus({
            checking: false,
            ok: false,
            message: `Cannot reach backend at ${client.defaults.baseURL}: ${err.message}`,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex-1 bg-slate-50">
      {/* Backend connection pill */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 font-medium">Backend API Status:</span>
            {backendStatus.checking ? (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Checking connection...
              </span>
            ) : backendStatus.ok ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {backendStatus.message}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {backendStatus.message}
              </span>
            )}
          </div>

          {isAuthenticated && (
            <div className="text-slate-500">
              Logged in as <strong className="text-slate-800">{user?.name}</strong> ({user?.role})
            </div>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-white to-slate-50 py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Next-Gen High-Concurrency Event Booking
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
            Experience Live Events With{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">
              Zero-Overbooking
            </span>{' '}
            Confidence
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Atomic seat reservations powered by FastAPI, MongoDB Motor atomic CAS operations,
            and an ultra-responsive React interface.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {!isAuthenticated ? (
              <>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition-all"
                >
                  Sign In
                </Link>
              </>
            ) : isAdmin ? (
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg transition-all"
              >
                Go to Admin Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/bookings"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg transition-all"
              >
                View My Bookings
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Atomic Concurrency</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Guaranteed zero-overselling through atomic MongoDB CAS operations tested under 50 simultaneous concurrent booking spikes.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Role-Based Security</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              JWT tokens with bcrypt password hashing, SlowAPI rate-limiting protection, and granular admin / user permissions.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Dynamic QR Tickets</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Automated email confirmations with background tasks and instant downloadable QR codes for seamless check-in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
