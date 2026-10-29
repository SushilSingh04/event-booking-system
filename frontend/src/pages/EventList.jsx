import React, { useState, useEffect, useCallback } from 'react';
import client, { getErrorMessage } from '../api/client';
import EventCard from '../components/EventCard';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import {
  Search,
  Filter,
  Calendar,
  RotateCcw,
  AlertCircle,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';

const CATEGORIES = [
  'All',
  'Technology',
  'Music',
  'Sports',
  'Workshop',
  'Cinema',
];

const EventList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const pageSize = 9;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        page,
        limit: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      if (appliedSearch.trim()) {
        params.search = appliedSearch.trim();
      }

      if (category && category !== 'All') {
        params.category = category;
      }

      if (startDate) {
        params.start_date = `${startDate}T00:00:00Z`;
      }

      if (endDate) {
        params.end_date = `${endDate}T23:59:59Z`;
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
  }, [page, pageSize, sortBy, sortOrder, appliedSearch, category, startDate, endDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Handle search form submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setCategory('');
    setStartDate('');
    setEndDate('');
    setSortBy('date');
    setSortOrder('asc');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    appliedSearch || (category && category !== 'All') || startDate || endDate
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-8 text-center sm:text-left sm:flex sm:items-end sm:justify-between border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Discover Live Experiences
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Upcoming Events
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse through conferences, concerts, workshops, and sports matches.
          </p>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 sm:mt-0 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All Filters
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 mb-8">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          {/* Top Row: Search input + Category selection */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Search Box */}
            <div className="lg:col-span-5 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search events by title or keywords..."
                className="block w-full pl-10 pr-20 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                className="absolute inset-y-1.5 right-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Search
              </button>
            </div>

            {/* Category Dropdown */}
            <div className="lg:col-span-3">
              <select
                value={category || 'All'}
                onChange={(e) => {
                  setCategory(e.target.value === 'All' ? '' : e.target.value);
                  setPage(1);
                }}
                className="block w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Sorting Dropdown */}
            <div className="lg:col-span-4 flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [newSortBy, newSortOrder] = e.target.value.split('-');
                    setSortBy(newSortBy);
                    setSortOrder(newSortOrder);
                    setPage(1);
                  }}
                  className="block w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white transition-colors"
                >
                  <option value="date-asc">Date: Soonest First</option>
                  <option value="date-desc">Date: Furthest First</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="created_at-desc">Recently Added</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bottom Row: Date Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="block w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:outline-none bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="block w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-600 focus:outline-none bg-white"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <p className="text-slate-400 text-xs pb-2">
                Tip: Combine category and date filters to find your exact weekend events.
              </p>
            </div>
          </div>
        </form>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-16">
          <LoadingSpinner message="Loading events..." size="lg" />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
          <h3 className="font-bold text-base mb-1">Failed to Load Events</h3>
          <p className="text-xs max-w-md mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchEvents}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No events match your criteria"
          description="We couldn't find any events matching your selected filters. Try searching for something else or reset your filters."
          actionLabel="Clear Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <>
          {/* Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-8 border-t border-slate-200/80 pt-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default EventList;
