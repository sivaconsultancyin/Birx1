import { GameCardInfo } from '../components/GameCard.tsx';

export const ALL_GAMES: GameCardInfo[] = [
  {
    id: 'roulette',
    name: 'Roulette',
    tagline: 'European 37-pocket classic wheel',
    badge: 'Popular',
    isLive: true,
    activePlayers: 4820,
    minBet: 10,
    maxPayout: '36x Max',
    accentColor: 'from-amber-500/30 to-yellow-600/30',
    iconEmoji: '🎰',
    bannerBg: 'from-slate-900 to-amber-950/40'
  },
  {
    id: 'teen-patti',
    name: 'Teen Patti',
    tagline: 'Indian 3-card poker with Blind & Chaal',
    badge: 'Desi Classic',
    isLive: true,
    activePlayers: 8940,
    minBet: 50,
    maxPayout: 'Unlimited Pot',
    accentColor: 'from-emerald-500/30 to-teal-600/30',
    iconEmoji: '🃏',
    bannerBg: 'from-slate-900 to-emerald-950/40'
  },
  {
    id: 'aviator',
    name: 'Aviator',
    tagline: 'Rising plane crash multiplier game',
    badge: 'Hot',
    isLive: true,
    activePlayers: 12450,
    minBet: 10,
    maxPayout: '100x+ Flight',
    accentColor: 'from-rose-500/30 to-orange-600/30',
    iconEmoji: '🚀',
    bannerBg: 'from-slate-900 to-rose-950/40'
  },
  {
    id: 'dice',
    name: 'Dice',
    tagline: 'Roll 2 dice for Over, Under, or Lucky 7',
    badge: 'Fast',
    isLive: false,
    activePlayers: 3120,
    minBet: 10,
    maxPayout: '5.5x Doubles',
    accentColor: 'from-blue-500/30 to-indigo-600/30',
    iconEmoji: '🎲',
    bannerBg: 'from-slate-900 to-blue-950/40'
  },
  {
    id: 'dragon-tiger',
    name: 'Dragon Tiger',
    tagline: 'Quick 2-card showdown with 8:1 Tie',
    badge: 'Trending',
    isLive: true,
    activePlayers: 5670,
    minBet: 10,
    maxPayout: '9x Tie Win',
    accentColor: 'from-purple-500/30 to-pink-600/30',
    iconEmoji: '🐉',
    bannerBg: 'from-slate-900 to-purple-950/40'
  },
  {
    id: 'andar-bahar',
    name: 'Andar Bahar',
    tagline: 'Traditional Indian Joker card match',
    badge: 'Royal',
    isLive: true,
    activePlayers: 7310,
    minBet: 10,
    maxPayout: '2x Instant',
    accentColor: 'from-amber-600/30 to-rose-600/30',
    iconEmoji: '🪔',
    bannerBg: 'from-slate-900 to-amber-950/40'
  }
];
