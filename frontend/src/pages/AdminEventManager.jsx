import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import client, { getErrorMessage } from '../api/client';
import AdminNav from '../components/AdminNav';
import EventFormModal from '../components/EventFormModal';
import ConfirmationModal from '../components/ConfirmationModal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { formatEventDate, parseBackendDate } from '../utils/date';
import {
  Calendar,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  MapPin,
  Users,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

const CATEGORIES = [
  'All',
  'Technology',
  'Music',
  'Sports',
  'Workshop',
  'Cinema',
  'Conference',
  'Networking',
  'Other',
];

const AdminEventManager = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState(null);

  // Delete State
  const [eventToDelete, setEventToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState({ type: '', text: '' });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        page,
        limit: pageSize,
        sort_by: 'created_at',
        sort_order: 'desc',
      };

      if (appliedSearch.trim()) {
        params.search = appliedSearch.trim();
      }

      if (category && category !== 'All') {
        params.category = category;
      }

      const response = await client.get('/events', { params });
      const data = response.data;

      setEvents(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalItems(data.total || 0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, category]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setCategory('');
    setPage(1);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setSelectedEventForEdit(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (event) => {
    setSelectedEventForEdit(event);
    setIsFormModalOpen(true);
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;

    setDeleteLoading(true);
    setFeedbackMessage({ type: '', text: '' });

    try {
      await client.delete(`/events/${eventToDelete.id}`);
      setFeedbackMessage({
        type: 'success',
        text: `Event "${eventToDelete.title}" was successfully deleted.`,
      });
      setEventToDelete(null);
      await fetchEvents();
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: getErrorMessage(err),
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Admin Nav Subheader */}
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 mb-6 border-b border-slate-200/80 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Event Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create, update, inspect seating capacities, and delete catalog events
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Create New Event
          </button>
        </div>

        {/* Global Action Feedback Message */}
        {feedbackMessage.text && (
          <div
            className={`mb-6 p-4 rounded-2xl flex items-center justify-between text-sm ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{feedbackMessage.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage({ type: '', text: '' })}
              className="text-slate-400 hover:text-slate-600 font-bold ml-4"
            >
              &times;
            </button>
          </div>
        )}

        {/* Search & Category Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-6 shadow-xs">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by event title..."
                className="block w-full pl-10 pr-20 py-2 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white"
              />
              <button
                type="submit"
                className="absolute inset-y-1 right-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Search
              </button>
            </div>

            <div className="w-full sm:w-48">
              <select
                value={category || 'All'}
                onChange={(e) => {
                  setCategory(e.target.value === 'All' ? '' : e.target.value);
                  setPage(1);
                }}
                className="block w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:outline-none bg-white font-medium"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {(appliedSearch || (category && category !== 'All')) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </form>
        </div>

        {/* Events Table Container */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20">
              <LoadingSpinner message="Loading events..." size="lg" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-700">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <p className="font-semibold text-sm mb-3">{error}</p>
              <button
                type="button"
                onClick={fetchEvents}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                Try Again
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Calendar}
                title="No events found"
                description="No events match your current filter parameters. Try clearing the filter or create a new event."
                actionLabel="Create First Event"
                onAction={handleOpenCreateModal}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 sm:px-6">Event Details</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Price</th>
                    <th className="py-3.5 px-4">Seating Capacity</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((ev) => {
                    const booked = ev.total_seats - ev.available_seats;
                    const bookedPct = Math.round((booked / ev.total_seats) * 100);
                    const isSoldOut = ev.available_seats === 0;
                    const eventDate = parseBackendDate(ev.date);
                    const isPast = eventDate ? eventDate < new Date() : false;

                    return (
                      <tr key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Title & Category & Venue */}
                        <td className="py-4 px-4 sm:px-6">
                          <div className="font-bold text-slate-900 text-sm line-clamp-1 mb-1">
                            {ev.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {ev.category}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-rose-500" />
                              {ev.venue}
                            </span>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-4 px-4 whitespace-nowrap text-slate-700 text-xs font-medium">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            {formatEventDate(ev.date)}
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-4 px-4 whitespace-nowrap font-bold text-slate-900">
                          {ev.price === 0 ? 'Free' : `$${Number(ev.price).toFixed(2)}`}
                        </td>

                        {/* Seating Progress */}
                        <td className="py-4 px-4 min-w-[150px]">
                          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                            <span>
                              {ev.available_seats} / {ev.total_seats} left
                            </span>
                            <span className="font-semibold">{bookedPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                isSoldOut
                                  ? 'bg-rose-500'
                                  : ev.available_seats <= 10
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-600'
                              }`}
                              style={{ width: `${bookedPct}%` }}
                            />
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {isPast ? (
                            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-600">
                              Past
                            </span>
                          ) : isSoldOut ? (
                            <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-rose-100 text-rose-700">
                              Sold Out
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-700">
                              Active
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Public Link */}
                            <Link
                              to={`/events/${ev.id}`}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="View Event Details"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(ev)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit Event"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => setEventToDelete(ev)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Event"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Pagination */}
          {!loading && events.length > 0 && (
            <div className="border-t border-slate-100 p-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Event Create / Edit Modal */}
      <EventFormModal
        isOpen={isFormModalOpen}
        event={selectedEventForEdit}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => {
          setFeedbackMessage({
            type: 'success',
            text: selectedEventForEdit
              ? 'Event updated successfully.'
              : 'New event created successfully.',
          });
          fetchEvents();
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(eventToDelete)}
        title="Delete Event?"
        message={`Are you sure you want to delete "${eventToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete Event"
        cancelText="Cancel"
        isDanger={true}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setEventToDelete(null)}
      />
    </div>
  );
};

export default AdminEventManager;
