import { useEffect, useRef, useState } from 'react';
import type { GameLocation } from '../types';
import { loadGoogleMaps } from '../lib/googleMaps';

interface Props {
  location: GameLocation;
}

export default function StreetViewPanel({ location }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const compassArrowRef = useRef<SVGGElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let povListener: google.maps.MapsEventListener | null = null;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const pano = new google.maps.StreetViewPanorama(containerRef.current, {
          position: { lat: location.lat, lng: location.lng },
          pov: { heading: location.heading, pitch: location.pitch },
          addressControl: false,
          fullscreenControl: false,
          showRoadLabels: false,
          linksControl: true,
          zoomControl: true,
          panControl: false,
          motionTracking: false,
          motionTrackingControl: false,
        });
        panoRef.current = pano;
        const applyHeading = () => {
          const g = compassArrowRef.current;
          if (!g) return;
          const h = pano.getPov().heading ?? 0;
          // Rotate the N-arrow to point to real north relative to view heading.
          g.setAttribute('transform', `rotate(${-h} 16 16)`);
        };
        applyHeading();
        povListener = pano.addListener('pov_changed', applyHeading);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
      if (povListener) povListener.remove();
    };
  }, []);

  useEffect(() => {
    const pano = panoRef.current;
    if (!pano) return;
    pano.setPosition({ lat: location.lat, lng: location.lng });
    pano.setPov({ heading: location.heading, pitch: location.pitch });
  }, [location.id]);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-cream p-8 text-center">
        <div className="max-w-md">
          <p className="smallcaps text-warmgray text-xs mb-2">Street View unavailable</p>
          <p className="font-serif text-2xl mb-4">{error}</p>
          <p className="text-warmgray text-sm">
            Add <code className="font-ui">VITE_GOOGLE_MAPS_API_KEY</code> to{' '}
            <code className="font-ui">.env.local</code> and reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      {/* Compass — rotates with the player's view heading */}
      <div
        aria-hidden
        className="absolute top-16 left-4 z-30 pointer-events-none w-11 h-11 rounded-full bg-cream/95 border-2 border-ink shadow-md flex items-center justify-center"
      >
        <svg viewBox="0 0 32 32" className="w-7 h-7">
          <g ref={compassArrowRef}>
            <polygon points="16,4 20,17 16,13 12,17" fill="#8B1A1A" />
            <polygon
              points="16,28 20,15 16,19 12,15"
              fill="#6B6358"
              opacity="0.55"
            />
            <text
              x="16"
              y="3.5"
              textAnchor="middle"
              fontSize="5"
              fontWeight="800"
              fill="#1F1B16"
              fontFamily="Inter, system-ui, sans-serif"
            >
              N
            </text>
          </g>
        </svg>
      </div>
    </>
  );
}
