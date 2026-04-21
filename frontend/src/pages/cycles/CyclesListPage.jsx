import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ROUTES from '../../config/routes';

// KRA Cycles page merged into Dashboard. Redirect old /cycles links.
export default function CyclesListPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate(ROUTES.DASHBOARD, { replace: true }); }, [navigate]);
  return null;
}