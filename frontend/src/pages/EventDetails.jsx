import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import client, { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatEventDate } from '../utils/date';
import {
  Calendar,
  MapPin,
  Users,
  Ticket,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  LogIn,
  CreditCard,
  Sparkles,
} from 'lucide-react';

const categoryColors = {
  Technology: 'bg-blue-100 text-blue-800 border-blue-200',
  Music: 'bg-purple-100 text-purple-800 border-purple-200',
  Sports: 'bg-amber-100 text-amber-800 border-amber-200',
  Workshop: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Cinema: 'bg-rose-100 text-rose-800 border-rose-200',
};

const EventDetails = () => {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Booking form state
  const [seats, setSeats] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const [isSoldOutError, setIsSoldOutError] = useState(false);

  // Fetch event details
  const fetchEvent = useCallback(async () => {
    try {
      const response = await client.get(`/events/${id}`);
      setEvent(response.data);
      return response.data;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Synchronize and clamp selected seats whenever available seats update
  useEffect(() => {
    if (event) {
      if (event.available_seats <= 0) {
        setSeats(1);
      } else {
        const max = Math.min(event.available_seats, 10);
        setSeats((current) => (current > max ? max : current < 1 ? 1 : current));
      }
    }
  }, [event?.available_seats]);

  // Handle booking submission
  const handleBook = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }

    setBookingLoading(true);
    setBookingError('');
    setIsSoldOutError(false);
    setBookingSuccess(null);

    try {
      const response = await client.post(`/events/${id}/book`, { seats: Number(seats) });
      setBookingSuccess(response.data);

      // Refresh event details to reflect updated available seats
      await fetchEvent();
    } catch (err) {
      const status = err.response?.status;
      const msg = getErrorMessage(err);

      if (status === 409) {
        setIsSoldOutError(true);
        setBookingError(
          'Not enough seats remaining! The event may have just sold out or fewer seats are available.'
        );
        // Refresh event to display current seat count and clamp seats
        const updated = await fetchEvent();
        if (updated && updated.available_seats > 0) {
          const max = Math.min(updated.available_seats, 10);
          setSeats((prev) => (prev > max ? max : prev));
        }
      } else {
        setBookingError(msg);
      }
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner message="Loading event details..." size="lg" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200 mb-6">
          <p className="font-semibold">{error || 'Event not found.'}</p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
      </div>
    );
  }

  const isSoldOut = event.available_seats === 0;
  const isInsufficientSeats = !isSoldOut && seats > event.available_seats;
  const maxSelectableSeats = Math.min(event.available_seats, 10);
  const totalPrice = (seats * event.price).toFixed(2);
  const badgeStyle = categoryColors[event.category] || 'bg-slate-100 text-slate-800 border-slate-200';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all events
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Event Details (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${badgeStyle}`}>
                {event.category}
              </span>
              {isSoldOut ? (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  Sold Out
                </span>
              ) : event.available_seats <= 10 ? (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Only {event.available_seats} seats left
                </span>
              ) : (
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {event.available_seats} of {event.total_seats} seats available
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
              {event.title}
            </h1>

            {/* Event Meta Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-slate-100 text-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 mt-0.5">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="block font-semibold text-slate-900">Date & Time</span>
                  <span className="text-slate-600 text-xs sm:text-sm">
                    {formatEventDate(event.date, { weekday: 'long', month: 'long' })}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600 mt-0.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="block font-semibold text-slate-900">Venue Location</span>
                  <span className="text-slate-600 text-xs sm:text-sm">{event.venue}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2">About This Event</h2>
              <p className="text-slate-600 leading-relaxed whitespace-pre-line text-sm sm:text-base">
                {event.description}
              </p>
            </div>
          </div>

          {/* Seat Capacity Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                Live Seating Capacity
              </span>
              <span>
                {event.total_seats - event.available_seats} / {event.total_seats} Booked
              </span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isSoldOut
                    ? 'bg-rose-500'
                    : event.available_seats <= 10
                    ? 'bg-amber-500'
                    : 'bg-indigo-600'
                }`}
                style={{
                  width: `${Math.round(
                    ((event.total_seats - event.available_seats) / event.total_seats) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Booking Card (1 col) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-lg sticky top-24">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Reserve Your Spot</h3>
            <p className="text-xs text-slate-500 mb-6">
              Zero-overselling guarantee powered by atomic reservation.
            </p>

            {/* Price Header */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 mb-6 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">
                Price Per Ticket
              </span>
              <span className="text-2xl font-black text-indigo-600">
                {event.price === 0 ? 'Free' : `$${Number(event.price).toFixed(2)}`}
              </span>
            </div>

            {/* Feedback Banners */}
            {bookingSuccess && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-sm text-emerald-900">Booking Confirmed!</p>
                    <p className="mt-1">
                      Reserved <strong>{bookingSuccess.seats}</strong> seat(s).
                    </p>
                    <p className="mt-1 font-mono text-[11px] bg-white/70 px-2 py-1 rounded border border-emerald-200 inline-block">
                      Ticket: {bookingSuccess.ticket_code}
                    </p>
                    <div className="mt-3">
                      <Link
                        to="/bookings"
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 underline"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        Go to My Bookings
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {bookingError && (
              <div
                className={`mb-6 p-4 rounded-2xl border text-xs ${
                  isSoldOutError
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block text-sm">
                      {isSoldOutError ? 'Sold Out / Insufficient Seats' : 'Booking Error'}
                    </strong>
                    <p className="mt-1">{bookingError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Booking Form */}
            <form onSubmit={handleBook} className="space-y-5">
              {/* Seat Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Select Seats
                </label>
                {isSoldOut ? (
                  <div className="p-3 bg-slate-100 rounded-xl text-center text-xs font-semibold text-slate-500">
                    No seats available for booking
                  </div>
                ) : isInsufficientSeats ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-rose-100 text-rose-700 cursor-not-allowed"
                >
                  Insufficient Seats ({event.available_seats} Available)
                </button>
              ) : (
                  <select
                    value={seats}
                    onChange={(e) => {
                      setSeats(Number(e.target.value));
                      setBookingError('');
                      setIsSoldOutError(false);
                    }}
                    disabled={isSoldOut || bookingLoading}
                    className="block w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none bg-white font-medium"
                  >
                    {Array.from({ length: maxSelectableSeats }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'Seat' : 'Seats'}
                      </option>
                    ))}
                  </select>
                )}
                <span className="mt-1 text-[11px] text-slate-500 block">
                  {isSoldOut
                    ? 'Check back later for cancellations.'
                    : `Maximum ${maxSelectableSeats} seats per single booking transaction.`}
                </span>
              </div>

              {/* Total Calculation */}
              {!isSoldOut && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total Due:</span>
                  <span className="text-xl font-black text-slate-900">${totalPrice}</span>
                </div>
              )}

              {/* Booking CTA Button */}
              {isSoldOut ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-slate-200 text-slate-400 cursor-not-allowed"
                >
                  Event Sold Out
                </button>
              ) : !isAuthenticated ? (
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-indigo-500/25 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Book
                </button>
              ) : isInsufficientSeats ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-rose-100 text-rose-700 cursor-not-allowed"
                >
                  Insufficient Seats ({event.available_seats} Available)
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 shadow-md hover:shadow-indigo-500/25 transition-all"
                >
                  {bookingLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Securing Seats...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Confirm & Book ({seats} {seats === 1 ? 'Seat' : 'Seats'})
                    </>
                  )}
                </button>
              )}
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Instant confirmation & QR code generated
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
