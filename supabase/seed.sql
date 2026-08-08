-- ============================================================
-- BLOOD REIGN — Seed Data
-- Run this LAST (optional) to populate tournaments, products and
-- announcements so the app isn't empty on first load.
-- Safe to re-run: it clears these three tables first.
-- ============================================================

truncate table public.tournaments restart identity cascade;
truncate table public.products restart identity cascade;
truncate table public.announcements restart identity cascade;

-- ------------------------------------------------------------
-- TOURNAMENTS
-- ------------------------------------------------------------
insert into public.tournaments (name, mode, map, prize_label, sponsor, status, max_players, start_time, winner_username, is_grand_final) values
('BLOOD CUP #13',      'SOLO',  'Bermuda',   '500 DIAMONDS',  'GameZone PK',       'LIVE',      50, now() + interval '1 hour',   null, false),
('SQUAD WARS IV',      'SQUAD', 'Kalahari',  '2000 DIAMONDS', 'TechStore Karachi', 'LIVE',      16, now() + interval '2 hours',  null, false),
('KARACHI CLASH',      'DUO',   'Purgatory', '1000 DIAMONDS', null,                'UPCOMING',  25, now() + interval '2 days 4 hours', null, false),
('NIGHT OWL CUP',      'SOLO',  'Alpine',    '750 DIAMONDS',  null,                'UPCOMING',  50, now() + interval '4 days 12 hours', null, false),
('REIGN FINALS S1',    'SQUAD', 'Bermuda',   '5000 DIAMONDS', null,                'UPCOMING',  16, now() + interval '6 days', null, true),
('WEEKLY GRIND #8',    'SOLO',  'Bermuda',   '300 DIAMONDS',  null,                'COMPLETED', 50, now() - interval '2 days', 'xXBloodKingXx', false),
('LAHORE SHOWDOWN',    'DUO',   'Kalahari',  '800 DIAMONDS',  null,                'COMPLETED', 25, now() - interval '4 days', 'PakistanRaider', false),
('MIDNIGHT MAYHEM',    'SOLO',  'Alpine',    '400 DIAMONDS',  null,                'COMPLETED', 50, now() - interval '6 days', 'KarachiSniper', false);

-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------
insert into public.products (name, brand, category, price, rating, tag, gradient_from, gradient_to) values
('Zeesh Laptop Bag 15.6"',   'Zeesh',       'Laptop',  2499, 4.8, 'HOT', '#1a1a2e', '#2a2a3a'),
('Blood Reign School Pack',  'Blood Reign', 'School',  1299, 4.5, 'NEW', '#1a1a2e', '#2a2a3a'),
('Ladies Shoulder Premium',  'Blood Reign', 'Ladies',  1499, 4.7, 'HOT', '#1a1a2e', '#2a2a3a'),
('Travel Duffle Pro 40L',    'Blood Reign', 'Travel',  2999, 4.6, null,  '#1a1a2e', '#2a2a3a'),
('Zeesh Office Elite',       'Zeesh',       'Laptop',  2199, 4.9, 'NEW', '#1a1a2e', '#2a2a3a'),
('Kids Backpack Lite',       'Blood Reign', 'School',   899, 4.4, null,  '#1a1a2e', '#2a2a3a'),
('Ladies Tote XL',           'Blood Reign', 'Ladies',  1799, 4.8, 'HOT', '#1a1a2e', '#2a2a3a'),
('Waterproof Laptop Bag',    'Blood Reign', 'Laptop',  1999, 4.5, null,  '#1a1a2e', '#2a2a3a'),
('Trolley Travel 360°',      'Blood Reign', 'Travel',  3499, 4.7, null,  '#1a1a2e', '#2a2a3a'),
('Saree Bridal Bag',         'Blood Reign', 'Saree',   1199, 4.6, 'NEW', '#1a1a2e', '#2a2a3a'),
('School Bag USB Port',      'Blood Reign', 'School',  1599, 4.7, 'HOT', '#1a1a2e', '#2a2a3a'),
('Ladies Crossbody Mini',    'Blood Reign', 'Ladies',   999, 4.5, 'NEW', '#1a1a2e', '#2a2a3a');

-- ------------------------------------------------------------
-- ANNOUNCEMENTS
-- ------------------------------------------------------------
insert into public.announcements (message, active) values
('BLOOD CUP #13 registrations open', true),
('New bags collection arrived', true),
('Weekly leaderboard reset Sunday', true);

-- ------------------------------------------------------------
-- NOTE on leaderboard / player data:
-- Player rows (profiles) are created automatically when someone
-- signs up in the app (see handle_new_user trigger in schema.sql).
-- To seed a few demo players for testing, sign up 2-3 test accounts
-- in the app first, then run e.g.:
--
--   update public.profiles set total_kills = 847000, total_wins = 23, coins = 2450
--     where username = 'xXBloodKingXx';
--
-- so the leaderboard has something to show before real players join.
-- ------------------------------------------------------------
