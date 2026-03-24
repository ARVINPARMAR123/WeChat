import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import './Responsive.css'
import Navbar from './pages/Navbar/Navbar.jsx'
import { AppProvider } from './context/AppContext.jsx'
import AIAssistantPage from './pages/AIAssistantPage/AIAssistantPage.jsx'
import AboutPage from './pages/AboutPage/AboutPage.jsx'
import HistoryPage from './pages/HistoryPage/HistoryPage.jsx'
import ChatConversationPage from './pages/ChatConversationPage/ChatConversationPage.jsx'
import HomePage from './pages/HomePage/HomePage.jsx'
import LoginPage from './pages/LoginPage/LoginPage.jsx'
import PaymentsPage from './pages/PaymentsPage/PaymentsPage.jsx'
import ProfilePage from './pages/ProfilePage/ProfilePage.jsx'
import RegisterPage from './pages/RegisterPage/RegisterPage.jsx'
import StatusPage from './pages/StatusPage/StatusPage.jsx'
import { useAppContext } from './context/AppContext.jsx'

function EntryRedirect() {
  const { isAuthenticated, hasRegistered } = useAppContext()

  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  return <Navigate to={hasRegistered ? '/login' : '/register'} replace />
}

function ProtectedLayout() {
  const { isAuthenticated, hasRegistered } = useAppContext()

  if (!isAuthenticated) {
    return <Navigate to={hasRegistered ? '/login' : '/register'} replace />
  }

  return <Navbar />
}

function ProtectedPage({ children }) {
  const { isAuthenticated, hasRegistered } = useAppContext()

  if (!isAuthenticated) {
    return <Navigate to={hasRegistered ? '/login' : '/register'} replace />
  }

  return children
}

function RegisterEntry() {
  const { isAuthenticated } = useAppContext()

  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  return <RegisterPage />
}

function LoginEntry() {
  const { isAuthenticated } = useAppContext()

  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  return <LoginPage />
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<EntryRedirect />} />
          <Route path="/register" element={<RegisterEntry />} />
          <Route path="/login" element={<LoginEntry />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/assistant" element={<AIAssistantPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/status" element={<StatusPage />} />
          </Route>

          <Route
            path="/chat/:contactId"
            element={(
              <ProtectedPage>
                <ChatConversationPage />
              </ProtectedPage>
            )}
          />

          <Route path="*" element={<EntryRedirect />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}

export default App
