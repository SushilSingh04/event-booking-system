import React, { useState, useEffect } from 'react';
import client, { getErrorMessage } from '../api/client';
import { formatEventDate } from '../utils/date';
import { QrCode, Download, X, Calendar, MapPin, Users, AlertCircle, Copy, Check } from 'lucide-react';

const TicketModal = ({ isOpen, booking, onClose }) => {
  const [qrUrl, setQrUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let objectUrl = null;

    if (isOpen && booking?.id) {
      setLoading(true);
      setError('');
      setQrUrl(null);

      // Fetch the binary QR code PNG using the authenticated axios client
      client
        .get(`/bookings/${booking.id}/ticket`, {
          responseType: 'blob',
        })
        .then((response) => {
          objectUrl = URL.createObjectURL(response.data);
          setQrUrl(objectUrl);
        })
        .catch((err) => {
          setError(getErrorMessage(err));
        })
        .finally(() => {
          setLoading(false);
        });
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, booking?.id]);

  if (!isOpen || !booking) return null;

  const handleDownload = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `ticket-${booking.ticket_code || booking.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCode = () => {
    if (booking.ticket_code) {
      navigator.clipboard.writeText(booking.ticket_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const event = booking.event || {};

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="relative bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Ribbon */}
        <div className="bg-indigo-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            <h3 className="font-bold text-lg">Digital Entry Pass</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ticket Details & QR Code */}
        <div className="p-6">
          {/* Event Title */}
          <div className="text-center mb-5">
            <span className="text-xs uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
              {event.category || 'Event'}
            </span>
            <h4 className="text-xl font-bold text-slate-900 mt-2 line-clamp-2">
              {event.title || 'Event Booking'}
            </h4>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200/80 rounded-2xl mb-5">
            {loading ? (
              <div className="h-48 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs font-medium text-slate-500">Generating secure QR ticket...</span>
              </div>
            ) : error ? (
              <div className="h-48 flex flex-col items-center justify-center text-rose-600 text-center px-4">
                <AlertCircle className="w-8 h-8 mb-2" />
                <span className="text-xs font-medium">{error}</span>
              </div>
            ) : qrUrl ? (
              <div className="text-center">
                <img
                  src={qrUrl}
                  alt={`QR Ticket for ${booking.ticket_code}`}
                  className="w-48 h-48 mx-auto rounded-lg shadow-xs bg-white p-2 border border-slate-200"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Scan at the venue entrance for admission
                </p>
              </div>
            ) : null}
          </div>

          {/* Ticket Code Box */}
          <div className="flex items-center justify-between p-3 bg-slate-100 rounded-xl mb-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Ticket Reference Code
              </span>
              <span className="font-mono font-bold text-slate-900 tracking-wide text-sm">
                {booking.ticket_code}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Event Meta Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-4 mb-6">
            <div className="flex items-start gap-2 text-slate-600">
              <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block">Date & Time</span>
                <span>{formatEventDate(event.date)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-slate-600">
              <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block">Venue</span>
                <span className="line-clamp-2">{event.venue || 'TBA'}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-slate-600">
              <Users className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block">Reserved Seats</span>
                <span>{booking.seats} {booking.seats === 1 ? 'Seat' : 'Seats'}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-slate-600">
              <span className="font-bold text-indigo-600 text-sm mt-0.5">$</span>
              <div>
                <span className="font-semibold text-slate-900 block">Total Paid</span>
                <span>${Number(booking.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !qrUrl}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow transition-all"
            >
              <Download className="w-4 h-4" />
              Download Ticket PNG
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketModal;
