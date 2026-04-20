import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import locationsRaw from '../data/locations.json';
import type { GameLocation, RoundResult as RoundResultData } from '../types';
import { haversineMeters } from '../lib/distance';
import { pickDailyLocations, pickRandomLocations, todayDateStr } from '../lib/daily';
import { getUsername, hasPlayedToday, saveDailyResult } from '../lib/storage';
import { submitPlay } from '../lib/supabase';
import StreetViewPanel from '../components/StreetViewPanel';
import GuessMap from '../components/GuessMap';
import Timer from '../components/Timer';
import RoundResult from '../components/RoundResult';

const ROUND_MS = 60_000;
const TIMEOUT_PENALTY_M = 10_000;
const ALL = (locationsRaw as GameLocation[]).filter(
  (l) => !l.panoId || !l.panoId.startsWith('CAoS')
);

export default function Play() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const state = routerLocation.state as { started?: boolean; freeplay?: boolean } | null;
  const today = todayDateStr();

  // Redirect to home on raw page reload (no router state).
  useEffect(() => {
    if (!state?.started) {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const [locations, setLocations] = useState(() =>
    state?.freeplay ? pickRandomLocations(ALL) : pickDailyLocations(ALL)
  );
  const [mode, setMode] = useState<'daily' | 'freeplay'>(
    state?.freeplay ? 'freeplay' : 'daily'
  );
  const [gameKey, setGameKey] = useState(0);
  const [roundIdx, setRoundIdx] = useState(0);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [shownResult, setShownResult] = useState<RoundResultData | null>(null);
  const [results, setResults] = useState<RoundResultData[]>([]);
  const [done, setDone] = useState(false);

  // If daily already played, redirect home (free play links go through startFreePlay).
  useEffect(() => {
    if (mode === 'daily' && hasPlayedToday(today) && !done) {
      navigate('/results');
    }
  }, [mode, today, done, navigate]);

  if (locations.length === 0) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="smallcaps text-warmgray text-xs">No locations yet</p>
        <h1 className="font-serif text-3xl">
          Add some in the Curator first.
        </h1>
        <p className="text-warmgray max-w-md">
          The daily needs at least 2 easy, 2 medium, and 1 hard location.
        </p>
        <button
          type="button"
          onClick={() => navigate('/curate')}
          className="border border-ink px-6 py-3 font-ui uppercase tracking-widest text-xs hover:bg-ink hover:text-cream transition-colors"
        >
          Open Curator
        </button>
      </div>
    );
  }

  const location = locations[roundIdx];

  const submit = useCallback(
    (guess: { lat: number; lng: number } | null) => {
      const distanceM =
        guess === null
          ? TIMEOUT_PENALTY_M
          : haversineMeters(guess, { lat: location.lat, lng: location.lng });
      const result: RoundResultData = { location, guess, distanceM };
      setResults((r) => [...r, result]);
      setShownResult(result);
    },
    [location]
  );

  const handleManualSubmit = useCallback(() => {
    submit(pin);
  }, [submit, pin]);

  const handleTimeout = useCallback(() => {
    if (shownResult) return;
    submit(pin);
  }, [submit, pin, shownResult]);

  const advance = useCallback(() => {
    setShownResult(null);
    setPin(null);
    setMapExpanded(false);
    if (roundIdx + 1 >= locations.length) {
      setDone(true);
    } else {
      setRoundIdx((i) => i + 1);
    }
  }, [roundIdx, locations.length]);

  const startFreePlay = useCallback(() => {
    setLocations(pickRandomLocations(ALL));
    setMode('freeplay');
    setGameKey((k) => k + 1);
    setRoundIdx(0);
    setPin(null);
    setMapExpanded(false);
    setShownResult(null);
    setResults([]);
    setDone(false);
  }, []);

  const total = useMemo(
    () => results.reduce((s, r) => s + r.distanceM, 0),
    [results]
  );

  // When daily game finishes: save + submit to leaderboard, THEN navigate.
  // Navigating before the insert lands causes /results to render an empty board.
  useEffect(() => {
    if (!done || mode !== 'daily') return;
    let cancelled = false;
    saveDailyResult(today, results);
    const username = getUsername();
    const totalM = results.reduce((s, r) => s + r.distanceM, 0);
    const task = username
      ? submitPlay(today, username, totalM).catch(() => {})
      : Promise.resolve();
    task.finally(() => {
      if (!cancelled) navigate('/results');
    });
    return () => {
      cancelled = true;
    };
  }, [done, mode, today, results, navigate]);

  if (done) {
    if (mode === 'daily') {
      return (
        <div className="min-h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="smallcaps text-warmgray text-xs">Finalizing</p>
          <h1 className="font-serif text-3xl">Posting to leaderboard…</h1>
        </div>
      );
    }
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-6 p-8">
        <p className="smallcaps text-warmgray text-xs">Free Play — Final Score</p>
        <h1 className="font-serif text-6xl font-semibold tabular">
          {Math.round(total).toLocaleString()} m
        </h1>
        <p className="text-warmgray">across {results.length} rounds</p>
        <ul className="w-full max-w-md border-t border-rule">
          {results.map((r, i) => (
            <li
              key={r.location.id}
              className="flex justify-between border-b border-rule py-2 font-ui text-sm"
            >
              <span>Round {i + 1}</span>
              <span className="tabular">
                {Math.round(r.distanceM).toLocaleString()} m
              </span>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={startFreePlay}
            className="bg-brick text-cream px-6 py-3 font-ui uppercase tracking-widest text-xs hover:bg-ink transition-colors"
          >
            Free Play Again
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="border border-ink px-6 py-3 font-ui uppercase tracking-widest text-xs hover:bg-ink hover:text-cream transition-colors"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-cream">
      <StreetViewPanel key={`${gameKey}-${location.id}`} location={location} />
      <div className="absolute top-4 left-4 z-20 smallcaps text-cream/90 text-xs bg-ink/60 px-3 py-1.5 rounded-sm">
        {mode === 'freeplay' && 'Free Play — '}
        Round {roundIdx + 1} / {locations.length}
      </div>
      <div className="absolute top-4 right-4 z-20 bg-cream/85 px-3 py-1.5 rounded-sm border border-rule">
        <Timer
          durationMs={ROUND_MS}
          resetKey={location.id}
          onExpire={handleTimeout}
        />
      </div>
      <GuessMap
        expanded={mapExpanded}
        onExpand={() => setMapExpanded(true)}
        onPin={setPin}
        onSubmit={handleManualSubmit}
        pin={pin}
      />
      {shownResult && (
        <RoundResult result={shownResult} onContinue={advance} />
      )}
    </div>
  );
}
