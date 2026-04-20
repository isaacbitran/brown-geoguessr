import { useEffect, useRef, useState } from 'react';

interface Props {
  durationMs: number;
  resetKey: string | number;
  onExpire: () => void;
}

export default function Timer({ durationMs, resetKey, onExpire }: Props) {
  const [remaining, setRemaining] = useState(durationMs);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    expiredRef.current = false;
    const start = performance.now();
    setRemaining(durationMs);
    const id = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const rem = Math.max(0, durationMs - elapsed);
      setRemaining(rem);
      if (rem <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        window.clearInterval(id);
        onExpireRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [resetKey, durationMs]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const lowTime = totalSeconds <= 5;

  return (
    <div
      className={`tabular font-serif text-3xl font-semibold ${
        lowTime ? 'text-brick animate-pulse' : 'text-ink'
      }`}
    >
      {mm}:{ss.toString().padStart(2, '0')}
    </div>
  );
}
