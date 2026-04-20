import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';
import type { RoundResult as RoundResultData } from '../types';

interface Props {
  result: RoundResultData;
  onContinue: () => void;
}

function createDot(color: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = '16px';
  el.style.height = '16px';
  el.style.borderRadius = '50%';
  el.style.backgroundColor = color;
  el.style.border = '2px solid #F5F1E8';
  return el;
}

export default function RoundResult({ result, onContinue }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: google.maps.Map | null = null;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    const polylines: google.maps.Polyline[] = [];

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        const actual = { lat: result.location.lat, lng: result.location.lng };
        map = new google.maps.Map(mapDivRef.current, {
          center: actual,
          zoom: 14,
          mapId: 'result-map',
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        });

        const actualMarker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: actual,
          title: 'Actual',
          content: createDot('#1F1B16'),
        });
        markers.push(actualMarker);

        if (result.guess) {
          const guess = result.guess;
          const guessMarker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: guess,
            title: 'Your guess',
            content: createDot('#8B1A1A'),
          });
          markers.push(guessMarker);

          const line = new google.maps.Polyline({
            map,
            path: [guess, actual],
            strokeColor: '#8B1A1A',
            strokeOpacity: 0,
            icons: [
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                offset: '0',
                repeat: '12px',
              },
            ],
          });
          polylines.push(line);

          const bounds = new google.maps.LatLngBounds();
          bounds.extend(guess);
          bounds.extend(actual);
          map.fitBounds(bounds, 60);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      for (const m of markers) m.map = null;
      for (const p of polylines) p.setMap(null);
      map = null;
    };
  }, [result]);

  return (
    <div className="fixed inset-0 z-30 bg-cream/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-cream border border-rule shadow-md p-6 flex flex-col gap-4">
        <p className="smallcaps text-warmgray text-xs">Round Result</p>
        <div ref={mapDivRef} className="w-full h-64 border border-rule" />
        <div className="flex items-baseline justify-between border-t border-rule pt-4">
          <span className="font-serif text-4xl tabular">
            {Math.round(result.distanceM).toLocaleString()} m
          </span>
          <button
            type="button"
            onClick={onContinue}
            className="font-ui uppercase text-xs tracking-widest border border-ink px-4 py-2 hover:bg-ink hover:text-cream transition-colors"
          >
            Next round
          </button>
        </div>
      </div>
    </div>
  );
}
