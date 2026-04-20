import { Link } from 'react-router-dom';

export default function HowToPlay() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-6 p-8 text-center max-w-lg mx-auto">
      <h1 className="font-serif text-4xl font-semibold">How to Play</h1>
      <div className="border-t border-rule w-full" />
      <p className="font-body text-lg leading-relaxed">
        Each day, 5 Street View locations from around Brown's campus and
        Providence. You have 60 seconds per round to drop a pin where you think
        it is. Lowest total distance wins. Come back tomorrow for a new edition.
      </p>
      <div className="border-t border-rule w-full" />
      <Link
        to="/"
        className="text-warmgray text-xs font-ui uppercase tracking-widest hover:text-ink"
      >
        ← Back
      </Link>
    </div>
  );
}
