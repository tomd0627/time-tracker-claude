import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export const formatDate = (ts: number) => format(new Date(ts), 'MMM d, yyyy');
export const formatDateTime = (ts: number) => format(new Date(ts), 'MMM d, yyyy h:mm a');
export const formatTime = (ts: number) => format(new Date(ts), 'h:mm a');
export const formatShortDate = (ts: number) => format(new Date(ts), 'MMM d');

export const todayRange = () => ({
  from: startOfDay(new Date()).getTime(),
  to:   endOfDay(new Date()).getTime(),
});

export const thisWeekRange = () => ({
  from: startOfWeek(new Date(), { weekStartsOn: 1 }).getTime(),
  to:   endOfWeek(new Date(),   { weekStartsOn: 1 }).getTime(),
});

export const thisMonthRange = () => ({
  from: startOfMonth(new Date()).getTime(),
  to:   endOfMonth(new Date()).getTime(),
});

export const last30DaysRange = () => ({
  from: Date.now() - 30 * 24 * 60 * 60 * 1000,
  to:   Date.now(),
});
