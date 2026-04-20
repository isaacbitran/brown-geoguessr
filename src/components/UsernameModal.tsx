import { useState } from 'react';
import { setUsername } from '../lib/storage';

interface Props {
  onDone: (name: string) => void;
}

export default function UsernameModal({ onDone }: Props) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setUsername(trimmed);
    onDone(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-cream border border-rule p-8 flex flex-col gap-6">
        <h2 className="font-serif text-3xl text-center">Pick a name</h2>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          maxLength={20}
          placeholder="Your name"
          autoFocus
          className="w-full border border-rule bg-transparent px-4 py-3 font-ui text-sm focus:outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="w-full bg-brick text-cream py-3 font-ui uppercase tracking-widest text-xs disabled:opacity-40 hover:bg-ink transition-colors"
        >
          Let's go
        </button>
      </div>
    </div>
  );
}
