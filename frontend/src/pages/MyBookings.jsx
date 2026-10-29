import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import client, { getErrorMessage } from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import TicketModal from '../components/TicketModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatEventDate } from '../utils/date';
import {
  Ticket,
  Calendar,
  MapPin,
  Users,
  QrCode,
  XCircle,
  AlertCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

const MyBookings = () => {
  const [timeframe, setTimeframe] = useState('upcoming'); // 'upcoming' | 'past' | 'all'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected booking for QR ticket modal
  const [activeTicketBooking, setActiveTicketBooking] = useState(null);

  // Booking selected for cancellation confirmation
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState({ type: '', text: '' });
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await client.get('/bookings/me', {
        params: { timeframe },
      });
      setBookings(response.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Handle Cancellation
  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;

    setCancelLoading(true);
    setCancelMessage({ type: '', text: '' });

    try {
      await client.delete(`/bookings/${bookingToCancel.id}`);
      setCancelMessage({
        type: 'success',
        text: `Booking for "${bookingToCancel.event?.title || 'event'}" has been successfully cancelled. Seats have been restored.`,
      });
      setBookingToCancel(null);
      // Refresh bookings
      await fetchBookings();
    } catch (err) {
      setCancelMessage({
        type: 'error',
        text: getErrorMessage(err),
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCopyCode = (ticketCode) => {
    navigator.clipboard.writeText(ticketCode);
    setCopiedCode(ticketCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-8 border-b border-slate-200/80 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          My Bookings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your reserved event passes, view digital QR tickets, or cancel reservations.
        </p>

        {/* Timeframe Tabs */}
        <div className="mt-6 flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTimeframe('upcoming')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              timeframe === 'upcoming'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Upcoming Events
          </button>

          <button
            type="button"
            onClick={() => setTimeframe('past')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              timeframe === 'past'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Past Events
          </button>

          <button
            type="button"
            onClick={() => setTimeframe('all')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              timeframe === 'all'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All Bookings
          </button>
        </div>
      </div>

      {/* Global Alert / Cancellation Status Message */}
      {cancelMessage.text && (
        <div
          className={`mb-6 p-4 rounded-2xl flex items-center justify-between text-sm ${
            cancelMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{cancelMessage.text}</span>
          <button
            type="button"
            onClick={() => setCancelMessage({ type: '', text: '' })}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* Bookings Content */}
      {loading ? (
        <div className="py-16">
          <LoadingSpinner message="Retrieving your bookings..." size="lg" />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h3 className="font-bold mb-1">Failed to Load Bookings</h3>
          <p className="text-xs mb-4">{error}</p>
          <button
            type="button"
            onClick={fetchBookings}
            className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            Try Again
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={
            timeframe === 'upcoming'
              ? 'No upcoming bookings'
              : timeframe === 'past'
              ? 'No past event history'
              : 'You have not booked any events yet'
          }
          description="Explore upcoming conferences, concerts, and workshops to secure your spots today."
          actionLabel="Explore Events"
          onAction={() => (window.location.href = '/')}
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const event = booking.event || {};
            const isCancelled = booking.status === 'cancelled';
            const isConfirmed = booking.status === 'confirmed';
            const eventDate = event.date ? new Date(event.date) : null;
            const isFutureEvent = eventDate && eventDate > new Date();
            const canCancel = isConfirmed && isFutureEvent;

            return (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Left Section: Event Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Status Badge */}
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        isConfirmed
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isConfirmed ? 'Confirmed' : 'Cancelled'}
                    </span>

                    {event.category && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {event.category}
                      </span>
                    )}

                    <span className="text-xs text-slate-400">
                      Booked {formatEventDate(booking.booked_at)}
                    </span>
                  </div>

                  {/* Title linking to details */}
                  <Link
                    to={`/events/${booking.event_id}`}
                    className="text-xl font-bold text-slate-900 hover:text-indigo-600 transition-colors inline-block mb-3"
                  >
                    {event.title || 'Event Details'}
                  </Link>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      <span>{formatEventDate(event.date)}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      <span>{event.venue || 'Venue TBA'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-500" />
                      <span>
                        {booking.seats} {booking.seats === 1 ? 'Seat' : 'Seats'}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-900">
                      Paid: ${Number(booking.total_amount).toFixed(2)}
                    </div>
                  </div>

                  {/* Ticket Reference Code */}
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Ticket Code:</span>
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {booking.ticket_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(booking.ticket_code)}
                      className="text-slate-500 hover:text-indigo-600 p-1"
                      title="Copy Ticket Code"
                    >
                      {copiedCode === booking.ticket_code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Right Section: Actions */}
                <div className="flex flex-row md:flex-col items-center md:items-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {/* View Ticket QR Button */}
                  <button
                    type="button"
                    onClick={() => setActiveTicketBooking(booking)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-200 shadow-xs"
                  >
                    <QrCode className="w-4 h-4" />
                    View Ticket QR
                  </button>

                  {/* Cancel Button */}
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setBookingToCancel(booking)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel Booking
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Ticket Modal */}
      <TicketModal
        isOpen={Boolean(activeTicketBooking)}
        booking={activeTicketBooking}
        onClose={() => setActiveTicketBooking(null)}
      />

      {/* Cancellation Confirmation Dialog */}
      <ConfirmationModal
        isOpen={Boolean(bookingToCancel)}
        title="Cancel Event Booking?"
        message={`Are you sure you want to cancel your reservation of ${bookingToCancel?.seats} seat(s) for "${bookingToCancel?.event?.title}"? The reserved seats will be immediately released back to the event pool.`}
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        isDanger={true}
        loading={cancelLoading}
        onConfirm={handleConfirmCancel}
        onClose={() => setBookingToCancel(null)}
      />
    </div>
  );
};

export default MyBookings;
