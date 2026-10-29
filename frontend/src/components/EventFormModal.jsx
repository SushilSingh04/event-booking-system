import React, { useState, useEffect } from 'react';
import client, { getErrorMessage } from '../api/client';
import { toDatetimeLocal } from '../utils/date';
import { X, Calendar, MapPin, Users, DollarSign, Tag, FileText, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  'Technology',
  'Music',
  'Sports',
  'Workshop',
  'Cinema',
  'Conference',
  'Networking',
  'Other',
];

const EventFormModal = ({ isOpen, event, onClose, onSuccess }) => {
  const isEditing = Boolean(event?.id);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Technology',
    venue: '',
    date: '',
    price: '0.00',
    total_seats: '100',
    description: '',
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Number of seats already booked for an existing event
  const bookedSeats = isEditing ? (event.total_seats - event.available_seats) : 0;

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        category: event.category || 'Technology',
        venue: event.venue || '',
        date: toDatetimeLocal(event.date),
        price: event.price !== undefined ? String(event.price) : '0.00',
        total_seats: event.total_seats ? String(event.total_seats) : '100',
        description: event.description || '',
      });
    } else {
      // Default initial state for new event (date default: tomorrow 10:00 AM)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      setFormData({
        title: '',
        category: 'Technology',
        venue: '',
        date: toDatetimeLocal(tomorrow.toISOString()),
        price: '0.00',
        total_seats: '100',
        description: '',
      });
    }
    setErrors({});
    setServerError('');
  }, [event, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Event title is required.';
    } else if (formData.title.trim().length < 3 || formData.title.trim().length > 100) {
      newErrors.title = 'Title must be between 3 and 100 characters.';
    }

    if (!formData.category.trim()) {
      newErrors.category = 'Category is required.';
    }

    if (!formData.venue.trim()) {
      newErrors.venue = 'Venue location is required.';
    } else if (formData.venue.trim().length < 3 || formData.venue.trim().length > 100) {
      newErrors.venue = 'Venue must be between 3 and 100 characters.';
    }

    if (!formData.date) {
      newErrors.date = 'Event date and time is required.';
    } else {
      const selectedDate = new Date(formData.date);
      if (selectedDate <= new Date()) {
        newErrors.date = 'Event date must be in the future.';
      }
    }

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      newErrors.price = 'Price must be a valid number >= 0.';
    }

    const seatsNum = parseInt(formData.total_seats, 10);
    if (isNaN(seatsNum) || seatsNum <= 0) {
      newErrors.total_seats = 'Total seats must be a positive integer.';
    } else if (isEditing && seatsNum < bookedSeats) {
      newErrors.total_seats = `Total seats cannot be reduced below ${bookedSeats} (already booked seats).`;
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required.';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) {
      setServerError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError('');

    try {
      const payload = {
        title: formData.title.trim(),
        category: formData.category.trim(),
        venue: formData.venue.trim(),
        date: new Date(formData.date).toISOString(),
        price: parseFloat(formData.price),
        total_seats: parseInt(formData.total_seats, 10),
        description: formData.description.trim(),
      };

      if (isEditing) {
        await client.put(`/events/${event.id}`, payload);
      } else {
        await client.post('/events', payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="relative bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 transform transition-all my-8 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {isEditing ? 'Edit Event Details' : 'Create New Event'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? 'Update schedule, seating capacity, or venue details'
                : 'Publish an event to the public catalog with atomic reservations'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{serverError}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Event Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. NextGen Web Architecture Summit"
              className={`block w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none ${
                errors.title
                  ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20'
                  : 'border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600'
              }`}
            />
            {errors.title && <p className="mt-1 text-xs text-rose-600">{errors.title}</p>}
          </div>

          {/* Category & Venue Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Category
              </label>
              <div className="relative">
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="block w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white font-medium"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              {errors.category && <p className="mt-1 text-xs text-rose-600">{errors.category}</p>}
            </div>

            <div>
              <label htmlFor="venue" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Venue Location
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  id="venue"
                  name="venue"
                  type="text"
                  value={formData.venue}
                  onChange={handleChange}
                  placeholder="e.g. Moscone Center, San Francisco"
                  className={`block w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none ${
                    errors.venue
                      ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20'
                      : 'border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600'
                  }`}
                />
              </div>
              {errors.venue && <p className="mt-1 text-xs text-rose-600">{errors.venue}</p>}
            </div>
          </div>

          {/* Date & Time Row */}
          <div>
            <label htmlFor="date" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Event Date & Time
            </label>
            <div className="relative rounded-xl shadow-xs">
              <input
                id="date"
                name="date"
                type="datetime-local"
                value={formData.date}
                onChange={handleChange}
                className={`block w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none ${
                  errors.date
                    ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20'
                    : 'border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600'
                }`}
              />
            </div>
            {errors.date && <p className="mt-1 text-xs text-rose-600">{errors.date}</p>}
          </div>

          {/* Price & Total Seats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Ticket Price (USD)
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  className={`block w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none ${
                    errors.price
                      ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20'
                      : 'border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600'
                  }`}
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Enter 0 for free events</span>
              {errors.price && <p className="mt-1 text-xs text-rose-600">{errors.price}</p>}
            </div>

            <div>
              <label htmlFor="total_seats" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Total Seat Capacity
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Users className="w-4 h-4" />
                </div>
                <input
                  id="total_seats"
                  name="total_seats"
                  type="number"
                  min={isEditing ? bookedSeats : 1}
                  value={formData.total_seats}
                  onChange={handleChange}
                  placeholder="100"
                  className={`block w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none ${
                    errors.total_seats
                      ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20'
                      : 'border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600'
                  }`}
                />
              </div>
              {isEditing && (
                <span className="text-[11px] text-amber-700 mt-1 block font-medium">
                  {bookedSeats} seat(s) already booked. Minimum allowed: {bookedSeats}.
                </span>
              )}
              {errors.total_seats && (
                <p className="mt-1 text-xs text-rose-600">{errors.total_seats}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Event Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="Provide a detailed overview of the event, speakers, agenda, and instructions for attendees..."
              className={`block w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none ${
                errors.description
                  ? 'border-rose-300 focus:border-rose-500 bg-rose-50/20'
                  : 'border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600'
              }`}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-rose-600">{errors.description}</p>
            )}
          </div>

          {/* Form Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving Event...
                </>
              ) : isEditing ? (
                'Update Event'
              ) : (
                'Create Event'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventFormModal;
