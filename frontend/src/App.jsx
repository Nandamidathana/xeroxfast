import React, { useState, useEffect } from 'react';
import AdminPage from './components/AdminPage';
import UploadPage from './components/UploadPage';
import DashboardPage from './components/DashboardPage';
import PrintLayout from './components/PrintLayout';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Sync state with url changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);

    // Overwrite history.pushState to trigger popstate so we can programmatically navigate
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
    };
  }, []);

  // Simple path routing rules
  if (currentPath === '/u') {
    return <UploadPage />;
  }

  if (currentPath === '/shop') {
    return <DashboardPage />;
  }

  if (currentPath.startsWith('/print/')) {
    const jobId = currentPath.split('/print/')[1];
    return <PrintLayout jobId={jobId} />;
  }

  // Default is Admin panel
  return <AdminPage />;
}

export default App;
