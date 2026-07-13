-- ============================================================================
-- LinkUpNaija — user interests (onboarding interest selection)
-- Adds an interests array to users so people can pick what they're into
-- (Substack/Tinder style) and we can personalise events & recommendations.
-- ============================================================================

alter table public.users
  add column if not exists interests text[] not null default '{}';

-- GIN index so "events/people matching my interests" queries stay fast.
create index if not exists users_interests_gin on public.users using gin (interests);
