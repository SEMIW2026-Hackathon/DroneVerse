import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

/** Layout for signed-in pages; redirects to /login when there is no session. */
export function AppShell() {
  const { user, loading, logout } = useAuthStore();

  if (loading) return <div className="grid min-h-screen place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between bg-emerald-700 px-4 py-2 text-white">
        <Link to="/" className="font-bold">
          Droneverse 🚁🌾
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">{user.name}</span>
          <button onClick={logout} className="rounded-full bg-white/20 px-3 py-1">
            Sign out
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
