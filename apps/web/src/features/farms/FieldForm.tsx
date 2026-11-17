import { useState, type FormEvent } from 'react';
import { CROPS } from '../../lib/config';

interface Props {
  areaHa: number;
  onSave: (name: string, crop: string) => Promise<void>;
  onCancel: () => void;
}

/** Name + crop for a freshly drawn boundary. */
export function FieldForm({ areaHa, onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [crop, setCrop] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(name, crop);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const input = 'w-full rounded-xl border border-gray-300 px-3 py-2';
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-gray-600">Boundary drawn: about {areaHa.toFixed(2)} ha</p>
      <input
        className={input}
        placeholder="Field name, e.g. North Wheat"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
      />
      <input
        className={input}
        list="crop-options"
        placeholder="Crop"
        value={crop}
        onChange={(e) => setCrop(e.target.value)}
        required
      />
      <datalist id="crop-options">
        {CROPS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={busy}
          className="flex-1 rounded-xl bg-emerald-600 py-2 font-medium text-white disabled:opacity-50"
        >
          Save field
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-gray-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
