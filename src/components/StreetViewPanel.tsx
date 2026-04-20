import { useEffect, useRef, useState } from 'react';
import type { GameLocation } from '../types';
import { loadGoogleMaps } from '../lib/googleMaps';

interface Props {
  location: GameLocation;
}

export default function StreetViewPanel({ location }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
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

  return <div ref={containerRef} className="absolute inset-0" />;
}
