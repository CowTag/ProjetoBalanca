import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Animals from './pages/Animals';
import AnimalDetail from './pages/AnimalDetail';
import Devices from './pages/Devices';
import FarmPage from './pages/Farm';

export default function App() {
  const { user, loading } = useAuth();

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );

  if (!user)
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="animais" element={<Animals />} />
        <Route path="animais/:id" element={<AnimalDetail />} />
        <Route path="dispositivos" element={<Devices />} />
        <Route path="fazenda" element={<FarmPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
