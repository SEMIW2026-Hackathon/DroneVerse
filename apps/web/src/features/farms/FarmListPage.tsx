import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useFarmStore } from '../../store/useFarmStore';

export function FarmListPage() {
  const { farms, loadFarms, createFarm, deleteFarm } = useFarmStore();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFarms().catch((e: Error) => setError(e.message));
  }, [loadFarms]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createFarm(name);
      setName('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string, farmName: string) {
    if (!window.confirm(`Delete "${farmName}" and all its fields?`)) return;
    await deleteFarm(id).catch((e: Error) => setError(e.message));
  }

  return (
    <div className="mx-auto h-full max-w-2xl overflow-auto p-4">
      <h1 className="mb-4 text-xl font-bold text-emerald-900">Your farms</h1>
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
          placeholder="New farm name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white">
          Add farm
        </button>
      </form>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {farms.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
          >
            <Link to={`/farms/${f.id}`} className="flex-1">
              <div className="font-medium">{f.name}</div>
              <div className="text-sm text-gray-500">
                {f.fieldCount} {f.fieldCount === 1 ? 'field' : 'fields'}
              </div>
            </Link>
            <button onClick={() => remove(f.id, f.name)} className="text-sm text-red-600">
              Delete
            </button>
          </li>
        ))}
        {farms.length === 0 && (
          <li className="text-gray-500">No farms yet. Add your first one above.</li>
        )}
      </ul>
    </div>
  );
}
