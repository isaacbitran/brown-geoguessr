import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadGoogleMaps } from '../lib/googleMaps';
import {
  fetchLocations,
  saveLocation,
  deleteLocation,
} from '../lib/curatorApi';
import type { Difficulty, GameLocation } from '../types';

const PROVIDENCE_CENTER = { lat: 41.8268, lng: -71.4025 };

export default function Curate() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const svDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const coverageRef = useRef<google.maps.StreetViewCoverageLayer | null>(null);
  const previewMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const savedMarkersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());

  const [coverageOn, setCoverageOn] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [locations, setLocations] = useState<GameLocation[]>([]);
  const [hasSelection, setHasSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Initial load: existing locations + Google Maps init.
  useEffect(() => {
    fetchLocations().then(setLocations).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current || !svDivRef.current) return;

        const map = new google.maps.Map(mapDivRef.current, {
          center: PROVIDENCE_CENTER,
          zoom: 15,
          mapId: 'curator-map',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
          mapTypeId: 'roadmap',
          streetViewControl: false,
        });
        mapRef.current = map;

        const coverage = new google.maps.StreetViewCoverageLayer();
        coverage.setMap(map);
        coverageRef.current = coverage;

        const pano = new google.maps.StreetViewPanorama(svDivRef.current, {
          position: PROVIDENCE_CENTER,
          pov: { heading: 0, pitch: 0 },
          addressControl: false,
          fullscreenControl: false,
          showRoadLabels: false,
          linksControl: true,
          zoomControl: true,
          panControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          visible: false,
        });
        panoRef.current = pano;
        setMapReady(true);

        // Click on map → load Street View at that position.
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const latlng = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          pano.setPosition(latlng);
          pano.setVisible(true);
          setHasSelection(true);
          setError(null);
          if (previewMarkerRef.current) {
            previewMarkerRef.current.position = latlng;
          } else {
            const el = document.createElement('div');
            el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#8B1A1A;border:2px solid #F5F1E8;';
            previewMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
              map,
              position: latlng,
              content: el,
              zIndex: 999,
            });
          }
        });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Toggle coverage layer.
  useEffect(() => {
    const c = coverageRef.current;
    const m = mapRef.current;
    if (!c || !m) return;
    c.setMap(coverageOn ? m : null);
  }, [coverageOn]);

  // Render saved-location markers on the map whenever the list changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const loc of locations) {
      seen.add(loc.id);
      const existing = savedMarkersRef.current.get(loc.id);
      const color =
        loc.difficulty === 'easy'
          ? '#1F1B16'
          : loc.difficulty === 'medium'
            ? '#B8892E'
            : '#8B1A1A';
      if (existing) {
        existing.position = { lat: loc.lat, lng: loc.lng };
      } else {
        const el = document.createElement('div');
        el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};opacity:0.9;border:1.5px solid #F5F1E8;`;
        const m = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: loc.lat, lng: loc.lng },
          content: el,
          title: `${loc.id} (${loc.difficulty})`,
        });
        savedMarkersRef.current.set(loc.id, m);
      }
    }
    // Remove markers for deleted locations.
    for (const [id, marker] of savedMarkersRef.current.entries()) {
      if (!seen.has(id)) {
        marker.map = null;
        savedMarkersRef.current.delete(id);
      }
    }
  }, [locations, mapReady]);

  const handleSave = async () => {
    const pano = panoRef.current;
    if (!pano) return;
    const pos = pano.getPosition();
    const pov = pano.getPov();
    const panoId = pano.getPano();
    if (!pos) return;
    const loc: GameLocation = {
      id: `loc_${crypto.randomUUID().slice(0, 8)}`,
      lat: Number(pos.lat().toFixed(6)),
      lng: Number(pos.lng().toFixed(6)),
      panoId: panoId || null,
      heading: Math.round(pov.heading ?? 0),
      pitch: Math.round(pov.pitch ?? 0),
      difficulty,
    };
    const isPhotoSphere = panoId && panoId.startsWith('CAoS');
    setSaving(true);
    setError(null);
    try {
      await saveLocation(loc);
      setLocations((curr) => [...curr, loc]);
      if (isPhotoSphere) {
        setError('Saved, but this is a photo sphere (circle) — it may fail to load in-game due to Google rate limits. Road-based locations (blue lines) are more reliable.');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLocation(id);
      setLocations((curr) => curr.filter((l) => l.id !== id));
    } catch (e) {
      setError(String(e));
    }
  };

  const counts = {
    easy: locations.filter((l) => l.difficulty === 'easy').length,
    medium: locations.filter((l) => l.difficulty === 'medium').length,
    hard: locations.filter((l) => l.difficulty === 'hard').length,
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-cream">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-rule bg-cream">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-serif text-xl">
            ← Brown GeoGuessr
          </Link>
          <span className="smallcaps text-warmgray text-xs">Curator</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-ui">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={coverageOn}
              onChange={(e) => setCoverageOn(e.target.checked)}
            />
            Coverage layer
          </label>
          <div className="flex border border-ink">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-3 py-1.5 uppercase tracking-widest ${
                  difficulty === d ? 'bg-ink text-cream' : 'text-ink'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasSelection || saving}
            className="bg-brick text-cream px-4 py-1.5 uppercase tracking-widest disabled:opacity-40 hover:bg-ink transition-colors"
          >
            {saving ? 'Saving…' : 'Save view'}
          </button>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
        <div className="relative border-r border-rule">
          <div ref={mapDivRef} className="absolute inset-0" />
        </div>
        <div className="relative">
          <div ref={svDivRef} className="absolute inset-0 bg-cream" />
          {!hasSelection && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="font-serif text-warmgray text-lg text-center px-6">
                Click anywhere on the map to load Street View here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer with counts + saved list */}
      <footer className="border-t border-rule bg-cream px-4 py-2 max-h-48 overflow-auto">
        <div className="flex items-center justify-between text-xs font-ui mb-2">
          <span className="smallcaps text-warmgray">
            Saved: {locations.length}{' '}
            <span className="text-ink/70">
              ({counts.easy} easy · {counts.medium} medium · {counts.hard} hard)
            </span>
          </span>
          {error && <span className="text-brick">{error}</span>}
        </div>
        {locations.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
            {locations.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 py-1 border-b border-rule/60 text-xs font-ui"
              >
                <button
                  type="button"
                  onClick={() => {
                    const pano = panoRef.current;
                    if (!pano) return;
                    if (l.panoId) pano.setPano(l.panoId);
                    else pano.setPosition({ lat: l.lat, lng: l.lng });
                    pano.setPov({ heading: l.heading, pitch: l.pitch });
                    pano.setVisible(true);
                    setHasSelection(true);
                    mapRef.current?.panTo({ lat: l.lat, lng: l.lng });
                  }}
                  className="flex-1 text-left truncate hover:underline"
                  title={l.id}
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 align-middle ${
                      l.difficulty === 'easy'
                        ? 'bg-ink'
                        : l.difficulty === 'medium'
                          ? 'bg-gold'
                          : 'bg-brick'
                    }`}
                  />
                  {l.id} <span className="text-warmgray">— {l.difficulty}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(l.id)}
                  className="text-warmgray hover:text-brick"
                  title="Delete"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  );
}
