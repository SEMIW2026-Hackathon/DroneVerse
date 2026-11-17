import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { setUnauthorizedHandler } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { LoginPage } from '../features/auth/LoginPage';
import { FarmListPage } from '../features/farms/FarmListPage';
import { FarmDetailPage } from '../features/farms/FarmDetailPage';
import { FleetPage } from '../features/fleet/FleetPage';
import { MissionPlannerPage } from '../features/mission-planner/MissionPlannerPage';
import { PreflightPage } from '../features/preflight/PreflightPage';
import { AppShell } from './AppShell';
import { Farm3DPage } from '../three/Farm3DPage';

export function App() {
  useEffect(() => {
    setUnauthorizedHandler(() => useAuthStore.getState().clear());
    void useAuthStore.getState().init();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<FarmListPage />} />
          <Route path="/farms/:farmId" element={<FarmDetailPage />} />
          <Route path="/farms/:farmId/plan" element={<MissionPlannerPage />} />
          <Route path="/farms/:farmId/3d" element={<Farm3DPage />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/preflight" element={<PreflightPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
