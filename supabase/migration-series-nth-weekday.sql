-- "Every last Friday of the month."
--
-- event_series.frequency is text with a CHECK constraint allowing exactly
-- weekly, biweekly and monthly, and "monthly" has only ever meant the same
-- day NUMBER next month. So a host who runs something on the last Friday
-- could not express it: picking Friday 30 October and choosing Monthly gave
-- 30 November, which is a Monday, then 30 December, a Wednesday.
--
-- monthly_nth means "the same weekday position each month", which is how a
-- person actually says it: the last Friday, the second Tuesday. The app
-- works out which from the first date and writes the dates itself.
--
-- WITHOUT THIS THE FEATURE FAILS AT THE INSERT. The constraint rejects the
-- new value, and the host sees a database error at the end of a long form,
-- which is exactly how recurring series was quietly broken for two months
-- before. Run this before the code that writes it.

alter table public.event_series
  drop constraint if exists event_series_frequency_check;

alter table public.event_series
  add constraint event_series_frequency_check
  check (frequency in ('weekly', 'biweekly', 'monthly', 'monthly_nth'));

comment on column public.event_series.frequency is
  'weekly | biweekly | monthly (same day number) | monthly_nth (same weekday position, e.g. the last Friday). Nothing stores WHICH weekday: it is derived from the series'' first event.';
