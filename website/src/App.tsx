import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import { ThemeProvider } from './components/ThemeContext';
import ErrorLogs from './pages/ErrorLogs';
import LandingPage from './pages/LandingPage';
import ReviewQueue from './pages/ReviewQueue';
import SavedSearches from './pages/SavedSearches';
import ScanTrigger from './pages/ScanTrigger';
import SearchHistory from './pages/SearchHistory';

function App() {
  return (
    <ThemeProvider>
      <div className="app">
        <div className="site-background" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/review-queue" replace />} />
              <Route path="review-queue" element={<ReviewQueue />} />
              <Route path="keywords" element={<Navigate to="/admin/scan" replace />} />
              <Route path="tags" element={<Navigate to="/admin/scan" replace />} />
              <Route path="scan" element={<ScanTrigger />} />
              <Route path="saved-searches" element={<SavedSearches />} />
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
