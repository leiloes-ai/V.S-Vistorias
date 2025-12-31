
import React, { useState, useContext, useEffect, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import Notification from './components/Notification.tsx';
import { AppContext } from './contexts/AppContext.tsx';
import LoginPage from './pages/LoginPage.tsx';
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal.tsx';
import { onMessage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";
import { messaging } from './firebaseConfig.ts';

// Dynamically import pages for code-splitting
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const Appointments = lazy(() => import('./pages/Appointments.tsx'));
const Pendent = lazy(() => import('./pages/Pendent.tsx'));
const NewRequests = lazy(() => import('./pages/NewRequests.tsx'));
const Users = lazy(() => import('./pages/Users.tsx'));
const Settings = lazy(() => import('./pages/Settings.tsx'));
const Profile = lazy(() => import('./pages/Profile.tsx'));
const Reports = lazy(() => import('./pages/Reports.tsx'));
const Financial = lazy(() => import('./pages/Financial.tsx'));


export type Page = 'Dashboard' | 'Agendamentos' | 'Pendências' | 'Novas Solicitações' | 'Relatórios' | 'Usuários' | 'Configurações' | 'Meu Perfil' | 'Financeiro';

const PageLoader: React.FC = () => (
    <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
             <svg className="mx-auto h-12 w-12 animate-spin text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
    </div>
);


const App: React.FC = () => {
  const { user, activePage, notification, clearNotification, loading, triggerNotification } = useContext(AppContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isForcePasswordChangeOpen, setIsForcePasswordChangeOpen] = useState(false);

  useEffect(() => {
    if (user && user.forcePasswordChange) {
      setIsForcePasswordChangeOpen(true);
    } else {
      setIsForcePasswordChangeOpen(false);
    }
  }, [user]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (user && messaging) {
        try {
            unsubscribe = onMessage(messaging, (payload) => {
                console.log("Foreground message received.", payload);
                if (payload.notification?.body) {
                    // Using the existing AppContext notification system
                    triggerNotification(payload.notification.body);
                }
            });
        } catch (error) {
            console.error("Error setting up foreground message listener:", error);
        }
    }
    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [user, triggerNotification]);


  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Agendamentos':
        return <Appointments />;
      case 'Pendências':
        return <Pendent />;
      case 'Novas Solicitações':
        return <NewRequests />;
      case 'Relatórios':
        return <Reports />;
      case 'Financeiro':
        return <Financial />;
      case 'Usuários':
        return <Users />;
      case 'Meu Perfil':
        return <Profile />;
      case 'Configurações':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Carregando sistema...</h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Por favor, aguarde.</p>
          </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="relative flex h-screen bg-gray-100 dark:bg-gray-900 font-sans overflow-hidden">
      {isForcePasswordChangeOpen && <ForcePasswordChangeModal onClose={() => setIsForcePasswordChangeOpen(false)} />}
      
      {notification && <Notification message={notification} onClose={clearNotification} />}
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header currentPage={activePage} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
          <Suspense fallback={<PageLoader />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default App;