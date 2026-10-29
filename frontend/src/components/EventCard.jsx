import React from 'react';
import { Link } from 'react-router-dom';
import { formatEventDate } from '../utils/date';
import { Calendar, MapPin, Users, ArrowRight } from 'lucide-react';

const categoryColors = {
  Technology: 'bg-blue-100 text-blue-800 border-blue-200',
  Music: 'bg-purple-100 text-purple-800 border-purple-200',
  Sports: 'bg-amber-100 text-amber-800 border-amber-200',
  Workshop: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Cinema: 'bg-rose-100 text-rose-800 border-rose-200',
};

const EventCard = ({ event }) => {
  const isSoldOut = event.available_seats === 0;
  const isLowStock = event.available_seats > 0 && event.available_seats <= 10;
  const badgeStyle = categoryColors[event.category] || 'bg-slate-100 text-slate-800 border-slate-200';

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      <div className="p-6 flex-1 flex flex-col">
        {/* Top bar: Category and Seat Availability Badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeStyle}`}
          >
            {event.category}
          </span>

          {isSoldOut ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
              Sold Out
            </span>
          ) : isLowStock ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Only {event.available_seats} left!
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              {event.available_seats} seats left
            </span>
          )}
        </div>

        {/* Event Title */}
        <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">
          {event.title}
        </h3>

        {/* Event Description */}
        <p className="text-sm text-slate-600 line-clamp-2 mb-4 leading-relaxed">
          {event.description}
        </p>

        {/* Date & Venue Info */}
        <div className="mt-auto space-y-2 pt-4 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span className="font-medium text-slate-700">
              {formatEventDate(event.date, { weekday: 'short' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span className="line-clamp-1">{event.venue}</span>
          </div>
        </div>
      </div>

      {/* Card Footer: Price & CTA Button */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500 block">Price per ticket</span>
          <span className="text-lg font-black text-slate-900">
            {event.price === 0 ? 'Free' : `$${Number(event.price).toFixed(2)}`}
          </span>
        </div>

        <Link
          to={`/events/${event.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow transition-all"
        >
          View Details
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default EventCard;
