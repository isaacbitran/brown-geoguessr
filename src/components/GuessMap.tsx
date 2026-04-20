import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';

interface Props {
  expanded: boolean;
  onExpand: () => void;
  onPin: (latlng: { lat: number; lng: number }) => void;
  onSubmit: () => void;
  pin: { lat: number; lng: number } | null;
}

const PROVIDENCE_CENTER = { lat: 41.8268, lng: -71.4025 };

function createPinElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = '14px';
  el.style.height = '14px';
  el.style.borderRadius = '50%';
  el.style.backgroundColor = '#8B1A1A';
  el.style.border = '2px solid #F5F1E8';
  el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
  return el;
}

export default function GuessMap({ expanded, onExpand, onPin, onSubmit, pin }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current || mapRef.current) return;
        const map = new google.maps.Map(mapDivRef.current, {
          center: PROVIDENCE_CENTER,
          zoom: 14,
          mapId: 'guess-map',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
          mapTypeId: 'roadmap',
        });
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          onPinRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
        mapRef.current = map;
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pin) {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
      return;
    }
    if (markerRef.current) {
      markerRef.current.position = pin;
    } else {
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: pin,
        content: createPinElement(),
      });
    }
  }, [pin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => {
      const center = map.getCenter();
      google.maps.event.trigger(map, 'resize');
      if (center) map.setCenter(center);
    }, 220);
    return () => clearTimeout(t);
  }, [expanded, isHovered]);

  const isOpen = expanded || isHovered;

  return (
    <div
      className={`absolute right-4 bottom-4 z-20 transition-all duration-200 ease-out aspect-square ${
        isOpen ? 'w-[min(55vmin,600px)]' : 'w-[200px]'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onExpand}
    >
      <div className="absolute inset-0 border border-rule shadow-sm bg-white overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-warmgray">
            Map failed to load: {error}
          </div>
        ) : (
          <div ref={mapDivRef} className="absolute inset-0" />
        )}
      </div>
      {pin && isOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSubmit();
          }}
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brick text-cream px-5 py-2 font-ui text-xs uppercase tracking-widest rounded-sm shadow-sm hover:bg-ink transition-colors"
        >
          Guess
        </button>
      )}
    </div>
  );
}
