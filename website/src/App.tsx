import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import ReviewQueue from './pages/ReviewQueue';
import KeywordManagement from './pages/KeywordManagement';
import TagManagement from './pages/TagManagement';
import ScanTrigger from './pages/ScanTrigger';
import SavedSearches from './pages/SavedSearches';
import SearchHistory from './pages/SearchHistory';
import ErrorLogs from './pages/ErrorLogs';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/review-queue" replace />} />
          <Route path="review-queue" element={<ReviewQueue />} />
          <Route path="keywords" element={<KeywordManagement />} />
          <Route path="tags" element={<TagManagement />} />
          <Route path="scan" element={<ScanTrigger />} />
          <Route path="saved-searches" element={<SavedSearches />} />
          <Route path="history" element={<SearchHistory />} />
          <Route path="logs" element={<ErrorLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
