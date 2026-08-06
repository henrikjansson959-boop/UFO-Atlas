import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import AdminCases from './pages/AdminCases';
import { ThemeProvider } from './components/ThemeContext';
import ContentLibrary from './pages/ContentLibrary';
import CaseDetail from './pages/CaseDetail';
import CasesDirectory from './pages/CasesDirectory';
import ErrorLogs from './pages/ErrorLogs';
import LandingPage from './pages/LandingPage';
import PeopleDirectory from './pages/PeopleDirectory';
import PersonProfile from './pages/PersonProfile';
import ReviewQueue from './pages/ReviewQueue';
import ScanTrigger from './pages/ScanTrigger';
import SearchHistory from './pages/SearchHistory';

const IncidentMap = lazy(() => import('./pages/IncidentMap'));

function App() {
  return (
    <ThemeProvider>
      <div className="app">
        <div className="site-background" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/content" element={<ContentLibrary />} />
            <Route
              path="/map"
              element={(
                <Suspense fallback={<div className="incident-map-loading" aria-label="Opening incident map" />}>
                  <IncidentMap />
                </Suspense>
              )}
            />
            <Route path="/cases" element={<CasesDirectory />} />
            <Route path="/cases/:slug" element={<CaseDetail />} />
            <Route path="/people" element={<PeopleDirectory />} />
            <Route path="/people/:slug" element={<PersonProfile />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/scan" replace />} />
              <Route path="review-queue" element={<ReviewQueue />} />
              <Route path="cases" element={<AdminCases />} />
              <Route path="keywords" element={<Navigate to="/admin/scan" replace />} />
              <Route path="tags" element={<Navigate to="/admin/scan" replace />} />
              <Route path="scan" element={<ScanTrigger />} />
              <Route path="history" element={<SearchHistory />} />
              <Route path="logs" element={<ErrorLogs />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;
