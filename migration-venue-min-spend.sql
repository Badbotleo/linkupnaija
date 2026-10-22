-- The two facts that would have saved the book club booking.
--
-- The options list modelled a CHOICE: pre-order, or set menu, or deposit.
-- Luna's phone call was neither. It was a minimum spend of "N100,000 to
-- N150,000", which is a threshold rather than an option, and a range rather
-- than a figure. The host could not tell which number she was agreeing to,
-- and a free book club cannot promise either.
--
-- So minimum spend gets its own column and it holds ONE integer. A venue
-- that wants to quote a range can put the reasoning in booking_note; the
-- number a host plans against has to be a number.
alter table public.venues
  add column if not exists min_spend integer,
  /**
   * Does this venue take a free event with no guaranteed spend?
   *
   * THREE STATES, AND THE THIRD IS THE POINT. true and false are answers.
   * NULL means nobody has asked, which is where all 304 other venues are and
   * is exactly what went wrong: we had Luna's address and not its policy, so
   * a host found out by being told after her flyer was printed.
   *
   * Rendered as "we have not checked" rather than hidden, because a host
   * deciding where to hold a free event is better served by an honest gap
   * than by silence that reads as consent.
   */
  add column if not exists free_events_ok boolean;

alter table public.venues
  drop constraint if exists venues_min_spend_check;
alter table public.venues
  add constraint venues_min_spend_check
  check (min_spend is null or min_spend >= 0);

grant select (min_spend, free_events_ok) on public.venues to anon, authenticated;
