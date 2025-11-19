-- Fix Row Level Security Policies for Multiplayer Game Creation

-- Drop existing policies
DROP POLICY IF EXISTS "Games are viewable by everyone" ON games;
DROP POLICY IF EXISTS "Players are viewable by everyone" ON players;
DROP POLICY IF EXISTS "Player stats are viewable by everyone" ON player_game_stats;
DROP POLICY IF EXISTS "Event log is viewable by everyone" ON event_log;

-- ========== GAMES TABLE POLICIES ==========

-- Allow everyone to view games
CREATE POLICY "Anyone can view games" 
  ON games FOR SELECT 
  USING (true);

-- Allow anyone to insert games (create new multiplayer games)
CREATE POLICY "Anyone can create games" 
  ON games FOR INSERT 
  WITH CHECK (true);

-- Allow anyone to update games (join games, update scores)
CREATE POLICY "Anyone can update games" 
  ON games FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- Allow deletion of old/expired games
CREATE POLICY "Anyone can delete games" 
  ON games FOR DELETE 
  USING (true);

-- ========== PLAYERS TABLE POLICIES ==========

-- Allow everyone to view players
CREATE POLICY "Anyone can view players" 
  ON players FOR SELECT 
  USING (true);

-- Allow anyone to insert player records
CREATE POLICY "Anyone can create player records" 
  ON players FOR INSERT 
  WITH CHECK (true);

-- Allow anyone to update player stats
CREATE POLICY "Anyone can update player records" 
  ON players FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- ========== PLAYER GAME STATS POLICIES ==========

-- Allow everyone to view stats
CREATE POLICY "Anyone can view player stats" 
  ON player_game_stats FOR SELECT 
  USING (true);

-- Allow anyone to insert stats
CREATE POLICY "Anyone can create player stats" 
  ON player_game_stats FOR INSERT 
  WITH CHECK (true);

-- ========== EVENT LOG POLICIES ==========

-- Allow everyone to view events
CREATE POLICY "Anyone can view events" 
  ON event_log FOR SELECT 
  USING (true);

-- Allow anyone to insert events
CREATE POLICY "Anyone can create events" 
  ON event_log FOR INSERT 
  WITH CHECK (true);

-- Note: For production, you should restrict these policies to authenticated users only
-- and implement proper authorization based on wallet addresses
