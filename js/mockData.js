/* ==========================================================
   BLOOD REIGN — Mock Data (used only when Supabase isn't configured)
   Mirrors supabase/seed.sql so behavior matches between modes.
   ========================================================== */

window.BR = window.BR || {};

BR.mockData = {
  tournaments: [
    { id: 't1', name: 'BLOOD CUP #13', mode: 'SOLO', map: 'Bermuda', prize_label: '500 DIAMONDS', sponsor: 'GameZone PK', status: 'LIVE', max_players: 50, current_players: 47, start_time: new Date(Date.now() + 36e5).toISOString(), winner_username: null, is_grand_final: false },
    { id: 't2', name: 'SQUAD WARS IV', mode: 'SQUAD', map: 'Kalahari', prize_label: '2000 DIAMONDS', sponsor: 'TechStore Karachi', status: 'LIVE', max_players: 16, current_players: 7, start_time: new Date(Date.now() + 72e5).toISOString(), winner_username: null, is_grand_final: false },
    { id: 't3', name: 'KARACHI CLASH', mode: 'DUO', map: 'Purgatory', prize_label: '1000 DIAMONDS', sponsor: null, status: 'UPCOMING', max_players: 25, current_players: 18, start_time: new Date(Date.now() + (2 * 86400 + 4 * 3600) * 1000).toISOString(), winner_username: null, is_grand_final: false },
    { id: 't4', name: 'NIGHT OWL CUP', mode: 'SOLO', map: 'Alpine', prize_label: '750 DIAMONDS', sponsor: null, status: 'UPCOMING', max_players: 50, current_players: 4, start_time: new Date(Date.now() + (4 * 86400 + 12 * 3600) * 1000).toISOString(), winner_username: null, is_grand_final: false },
    { id: 't5', name: 'REIGN FINALS S1', mode: 'SQUAD', map: 'Bermuda', prize_label: '5000 DIAMONDS', sponsor: null, status: 'UPCOMING', max_players: 16, current_players: 6, start_time: new Date(Date.now() + 6 * 86400 * 1000).toISOString(), winner_username: null, is_grand_final: true },
    { id: 't6', name: 'WEEKLY GRIND #8', mode: 'SOLO', map: 'Bermuda', prize_label: '300 DIAMONDS', sponsor: null, status: 'COMPLETED', max_players: 50, current_players: 50, start_time: new Date(Date.now() - 2 * 86400 * 1000).toISOString(), winner_username: 'xXBloodKingXx', is_grand_final: false },
    { id: 't7', name: 'LAHORE SHOWDOWN', mode: 'DUO', map: 'Kalahari', prize_label: '800 DIAMONDS', sponsor: null, status: 'COMPLETED', max_players: 25, current_players: 25, start_time: new Date(Date.now() - 4 * 86400 * 1000).toISOString(), winner_username: 'PakistanRaider', is_grand_final: false },
    { id: 't8', name: 'MIDNIGHT MAYHEM', mode: 'SOLO', map: 'Alpine', prize_label: '400 DIAMONDS', sponsor: null, status: 'COMPLETED', max_players: 50, current_players: 50, start_time: new Date(Date.now() - 6 * 86400 * 1000).toISOString(), winner_username: 'KarachiSniper', is_grand_final: false },
  ],

  products: [
    { id: 'p1', name: 'Zeesh Laptop Bag 15.6"', brand: 'Zeesh', category: 'Laptop', price: 2499, rating: 4.8, tag: 'HOT' },
    { id: 'p2', name: 'Blood Reign School Pack', brand: 'Blood Reign', category: 'School', price: 1299, rating: 4.5, tag: 'NEW' },
    { id: 'p3', name: 'Ladies Shoulder Premium', brand: 'Blood Reign', category: 'Ladies', price: 1499, rating: 4.7, tag: 'HOT' },
    { id: 'p4', name: 'Travel Duffle Pro 40L', brand: 'Blood Reign', category: 'Travel', price: 2999, rating: 4.6, tag: null },
    { id: 'p5', name: 'Zeesh Office Elite', brand: 'Zeesh', category: 'Laptop', price: 2199, rating: 4.9, tag: 'NEW' },
    { id: 'p6', name: 'Kids Backpack Lite', brand: 'Blood Reign', category: 'School', price: 899, rating: 4.4, tag: null },
    { id: 'p7', name: 'Ladies Tote XL', brand: 'Blood Reign', category: 'Ladies', price: 1799, rating: 4.8, tag: 'HOT' },
    { id: 'p8', name: 'Waterproof Laptop Bag', brand: 'Blood Reign', category: 'Laptop', price: 1999, rating: 4.5, tag: null },
    { id: 'p9', name: 'Trolley Travel 360°', brand: 'Blood Reign', category: 'Travel', price: 3499, rating: 4.7, tag: null },
    { id: 'p10', name: 'Saree Bridal Bag', brand: 'Blood Reign', category: 'Saree', price: 1199, rating: 4.6, tag: 'NEW' },
    { id: 'p11', name: 'School Bag USB Port', brand: 'Blood Reign', category: 'School', price: 1599, rating: 4.7, tag: 'HOT' },
    { id: 'p12', name: 'Ladies Crossbody Mini', brand: 'Blood Reign', category: 'Ladies', price: 999, rating: 4.5, tag: 'NEW' },
  ],

  announcements: [
    'BLOOD CUP #13 registrations open',
    'New bags collection arrived',
    'Weekly leaderboard reset Sunday',
  ],

  leaderboard: [
    { username: 'xXBloodKingXx',  total_kills: 847000, total_wins: 23, coins: 2450 },
    { username: 'PakistanRaider', total_kills: 731000, total_wins: 19, coins: 2100 },
    { username: 'KarachiSniper',  total_kills: 698000, total_wins: 17, coins: 1890 },
    { username: 'LahoriGamer99',  total_kills: 654000, total_wins: 15, coins: 1750 },
    { username: 'FreeFire_Zain',  total_kills: 612000, total_wins: 14, coins: 1620 },
    { username: 'BloodReignFan',  total_kills: 589000, total_wins: 13, coins: 1510 },
    { username: 'NightOwlPK',     total_kills: 567000, total_wins: 12, coins: 1400 },
    { username: 'DesertHawkFF',   total_kills: 534000, total_wins: 11, coins: 1280 },
    { username: 'RawalpindiKing', total_kills: 498000, total_wins: 10, coins: 1150 },
    { username: 'GujranwalaG',    total_kills: 467000, total_wins: 9,  coins: 1020 },
  ],
};
