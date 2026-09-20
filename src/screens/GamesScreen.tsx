import React, { useState } from 'react';
import { Dices, Search, Filter } from 'lucide-react';
import { GameId } from '../types.ts';
import { ALL_GAMES } from '../data/games.ts';
import { GameCard } from '../components/GameCard.tsx';

interface GamesScreenProps {
  onPlayGame: (id: GameId) => void;
}

export const GamesScreen: React.FC<GamesScreenProps> = ({ onPlayGame }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGames = ALL_GAMES.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.tagline.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="screen-games" className="px-3 pb-24 space-y-3">
      {/* Title & Stats */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Dices className="w-5 h-5 text-amber-500" />
            All Games ({ALL_GAMES.length})
          </h2>
          <p className="text-[11px] text-slate-400">Official 6-game Brix verified lineup</p>
        </div>
        <span className="text-[10px] uppercase font-bold text-amber-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
          Zero Lag RNG
        </span>
      </div>

      {/* Search Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-slate-500" />
        <input
          id="input-search-games"
          type="text"
          placeholder="Search Roulette, Aviator, Teen Patti..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* Exactly the 6 game cards */}
      <div className="grid grid-cols-1 gap-2.5 pt-1">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} onPlay={onPlayGame} />
        ))}

        {filteredGames.length === 0 && (
          <div className="text-center py-10 text-xs text-slate-500">
            No games found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
};
