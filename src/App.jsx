import './App.css';
import {
  Box,
  Flex,
  Button,
  Text,
  IconButton,
  VStack,
  Image,
  useBreakpointValue,
  Drawer,
  DrawerBackdrop,
  DrawerContent,
  DrawerBody,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import MemberLogin from './assets/pages/MemberLogin';
import StaffLogin from './assets/pages/StaffLogin';
import Register from './assets/pages/Register';
import StaffRegister from './assets/pages/StaffRegister';
import LoginLanding from './assets/pages/LoginLanding';
import SourceManagement from './assets/pages/SourceManagement';
import NewsFetchDashboard from './assets/pages/NewsFetchDashboard';
import IndustryManagement from './assets/pages/IndustryManagement'
import InterestManagement from './assets/pages/InterestManagement'
import CategoryManagement from './assets/pages/CategoryManagement'
import UserManagement from './assets/pages/UserManagement'
import MemberAnalytics from './assets/pages/MemberAnalytics'
import SetInitialPassword from './assets/pages/SetInitialPassword'
import SelectTopicsOfInterest from './assets/pages/SelectTopicsOfInterest'
import NotificationPreferences from './assets/pages/NotificationPreferences'
import NotificationFrequency from './assets/pages/NotificationFrequency'
import PreferencesSetup from './assets/pages/PreferencesSetup'
import MemberProfile from './assets/pages/MemberProfile'
import SavedArticles from './assets/pages/SavedArticles'
import BroadcastManagement from './assets/pages/BroadcastManagement';
import DraftsList from './assets/pages/DraftsList';
import MessageSent from './assets/pages/MessageSent';
import { p, path } from 'framer-motion/client';
import ArticlesList from './assets/pages/ArticleList';
import ArticleReview from './assets/pages/ArticleReview';
import PublishQueue from './assets/pages/PublishQueue';
import PublishArticle from './assets/pages/PublishArticle';
import PublicArticles from './assets/pages/PublicArticles';
import TopicsOfInterest from './assets/pages/TopicsOfInterest';
import ForgotPassword from './assets/pages/ForgotPassword';
import MemberArticles from './assets/pages/MemberArticles';
import MemberArticleDetail from './assets/pages/MemberArticleDetail';


// Sidebar component (trimmed to use only existing pages)
function Sidebar({ isCollapsed, onToggle, isLoggedIn, onLogout, isMobile, isOpen, onClose, userRole }) {
  const location = useLocation();
  const [isLoaded, setIsLoaded] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const userName = localStorage.getItem('name') || 'User';

  const fadeInUp = keyframes`
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  `;
  const slideInFromLeft = keyframes`
    from { transform: translateX(-30px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  `;

  useEffect(() => setIsLoaded(true), []);
  useEffect(() => { if (isLoaded) setAnimationKey(k => k + 1); }, [isCollapsed, isLoaded]);

  // SVG Icons for clean line style
  const icons = {
    dashboard: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1"/>
        <rect x="14" y="3" width="7" height="5" rx="1"/>
        <rect x="14" y="12" width="7" height="9" rx="1"/>
        <rect x="3" y="16" width="7" height="5" rx="1"/>
      </svg>
    ),
    users: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    category: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    sources: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    broadcast: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
        <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
        <circle cx="12" cy="12" r="2"/>
        <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
        <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>
      </svg>
    ),
    notifications: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    settings: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    profile: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    news: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8z"/>
      </svg>
    ),
    articles: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    publish: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
    ),
    logout: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    ),
    arrow: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    )
  };

  const navItemsByRole = {
    member: [
      { path: '/member/articles', label: 'Articles', icon: icons.news },
      { path: '/member/profile', label: 'My Profile', icon: icons.profile }
    ],
    consultant: [
      { path: '/landing', label: 'Dashboard', icon: icons.dashboard },
      { path: '/consultant/fetch', label: 'News Fetch Dashboard', icon: icons.news },
      { path: '/consultant/articles', label: 'Articles List', icon: icons.articles },
      { path: '/consultant/publish-queue', label: 'Publish Queue', icon: icons.publish }
    ],
    admin: [
      { path: '/admin/users', label: 'User Management', icon: icons.users },
      { path: '/admin/categories', label: 'Category Management', icon: icons.category },
      { path: '/admin/sources', label: 'Source Management', icon: icons.sources },
      { path: '/admin/broadcast', label: 'Broadcast Management', icon: icons.broadcast, hasArrow: true },
      { path: '/notification-preferences', label: 'Notifications', icon: icons.notifications },
      { path: '/landing', label: 'Settings', icon: icons.settings }
    ]
  };

  const navItems = isLoggedIn ? (navItemsByRole[userRole] || []) : [{ path: '/login', label: 'Login', icon: icons.dashboard }];

  const getRoleLabel = () => {
    if (userRole === 'admin') return 'Administrator';
    if (userRole === 'consultant') return 'Consultant';
    return 'Member';
  };

  const NavButton = ({ item, index }) => {
    const isActive = location.pathname === item.path;
    return (
      <Button
        as={Link}
        to={item.path}
        title={item.label}
        variant="ghost"
        w="100%"
        h="48px"
        justifyContent="flex-start"
        bg={isActive ? '#A10005' : 'transparent'}
        color={isActive ? 'white' : '#FFAAAC'}
        fontWeight={isActive ? '500' : '400'}
        fontSize="15px"
        borderRadius="0"
        px={8}
        _hover={{ bg: '#A10005', color: 'white' }}
        transition="all 0.2s"
      >
        <Flex align="center" justify="space-between" w="100%">
          <Flex align="center" gap={3}>
            <Box>{item.icon}</Box>
            <Text>{item.label}</Text>
          </Flex>
          {item.hasArrow && <Box opacity={0.7}>{icons.arrow}</Box>}
        </Flex>
      </Button>
    );
  };

  const SidebarContent = (
    <VStack spacing={0} align="stretch" h="100vh">
      {/* Logo Section with darker gradient */}
      <Box 
        py={4} 
        px={4}
        bg="linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 100%)"
      >
        <Flex align="center" justify="center">
          <Box w="120px" h="120px" display="flex" alignItems="center" justifyContent="center">
            <Image src="/src/assets/logo.png" alt="Logo" boxSize="120px" objectFit="contain" />
          </Box>
        </Flex>
      </Box>

      {/* Divider below logo */}
      <Box h="1px" bg="#A10005" w="100%" />

      {/* Navigation Items - Scrollable */}
      <Box 
        flex="1" 
        px={0} 
        pt={1} 
        overflowY="auto" 
        overflowX="hidden"
        css={{
          '&::-webkit-scrollbar': { display: 'none' },
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        <VStack spacing={1} align="stretch">
          {navItems.map((item, index) => (
            <Box 
              key={`${item.path}-${animationKey}`} 
              animation={isLoaded ? `${slideInFromLeft} 0.3s ease-out ${0.05 + index * 0.05}s both` : undefined}
            >
              <NavButton item={item} index={index} />
            </Box>
          ))}
        </VStack>
      </Box>
      
      {/* Bottom Section - Logout and User Info */}
      {isLoggedIn && (
        <Box px={0} pb={4}>
          {/* Divider above logout */}
          <Box h="1px" bg="#A10005" w="100%" mb={2} />

          {/* Logout Button */}
          <Button 
            variant="ghost"
            w="100%" 
            h="48px" 
            onClick={onLogout}
            color="#FFAAAC"
            fontWeight="400"
            fontSize="15px"
            borderRadius="0"
            justifyContent="flex-start"
            px={9}
            bg="transparent"
            _hover={{ bg: '#A10005', color: 'white' }}
            transition="all 0.2s"
            mb={2}
          >
            <Flex align="center" gap={3}>
              <Box>{icons.logout}</Box>
              <Text>Logout</Text>
            </Flex>
          </Button>

          {/* User Info */}
          <Flex align="center" mb={4} px={7} py={2}>
            <Box 
              w="40px" 
              h="40px" 
              borderRadius="50%" 
              bg="rgba(255,255,255,0.2)" 
              display="flex" 
              alignItems="center" 
              justifyContent="center"
              color="white"
              fontWeight="600"
              fontSize="16px"
            >
              {userName.charAt(0).toUpperCase()}
            </Box>
            <Box ml={3}>
              <Text color="white" fontWeight="500" fontSize="14px" lineHeight="1.3">{userName}</Text>
              <Text color="whiteAlpha.700" fontSize="12px">{getRoleLabel()}</Text>
            </Box>
          </Flex>
        </Box>
      )}
    </VStack>
  );

  if (isMobile) {
    return (
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
          <DrawerBackdrop />
          <DrawerContent maxW="280px" bg="#ba0006" borderTopRightRadius="20px" borderBottomRightRadius="20px">
            <DrawerBody p={0}>{SidebarContent}</DrawerBody>
          </DrawerContent>
        </Drawer>
    );
  }

  return (
    <Box 
      w="280px" 
      bg="#ba0006" 
      color="white" 
      minH="100vh" 
      position="fixed" 
      top={0} 
      left={0} 
      zIndex={1000} 
      transition="all 0.3s" 
      borderTopRightRadius="20px" 
      borderBottomRightRadius="20px"
    >
      {SidebarContent}
    </Box>
  );
}

// Local Separator used in place of a missing external component
function Separator({ borderColor = 'gray.200', mb, animation, ...rest }) {
  return (
    <Box
      as="div"
      height="1px"
      bg={borderColor}
      mb={mb}
      animation={animation}
      {...rest}
    />
  )
}

function AppContent() {
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('role') || 'client');

  const authPaths = ['/login', '/MemberLogin', '/StaffLogin', '/register', '/StaffRegister', '/forgot-password', '/set-initial-password', '/public-articles', '/topics-of-interest'];
  const isAuthPage = authPaths.includes(location.pathname) || location.pathname.startsWith('/reset-password');
  const showSidebar = isLoggedIn && !isAuthPage;

  // Check login status whenever location changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    setIsLoggedIn(!!token);
    if (role) {
      setUserRole(role);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleStorage = () => { setIsLoggedIn(!!localStorage.getItem('token')); setUserRole(localStorage.getItem('role') || 'client'); };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLoginSuccess = (role) => { setIsLoggedIn(true); setUserRole(role); };
  // navigate to landing after login
  const navigate = useNavigate();
  const handleLoginSuccessAndNavigate = (role) => {
    setIsLoggedIn(true);
    setUserRole(role);
    if (String(role).toLowerCase() === 'member') {
      navigate('/member/articles');
    } else {
      navigate('/landing');
    }
  };
  const handleLogout = () => { localStorage.removeItem('token'); setIsLoggedIn(false); navigate('/MemberLogin'); };

  const isMobile = useBreakpointValue({ base: true, md: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarWidth = showSidebar && !isMobile ? 280 : 0;

  // Use cream background for all dashboard pages
  const pageBg = '#FCF6F2';

  return (
    <>
      {/* Full-page background layer to ensure #FCF6F2 is everywhere */}
      <Box position="fixed" top={0} left={0} w="100vw" h="100vh" bg={pageBg} zIndex={-1} />
      
      <Flex minH="100vh" w="100vw" bg={pageBg} overflowX="hidden">
        {showSidebar && (
          <>
            {isMobile && <IconButton icon={<Box fontSize="2xl">☰</Box>} variant="ghost" position="fixed" top="16px" left="16px" zIndex="1500" onClick={() => setSidebarOpen(true)} aria-label="Open menu" />}
            {isMobile ? (
              sidebarOpen && <Sidebar isLoggedIn={isLoggedIn} onLogout={handleLogout} isMobile={true} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} userRole={userRole} />
            ) : (
              <Sidebar isLoggedIn={isLoggedIn} onLogout={handleLogout} isMobile={false} isOpen={false} onClose={() => {}} userRole={userRole} />
            )}
          </>
        )}

      <Box flex="1" p={isAuthPage ? 0 : 0} minH="100vh" ml={sidebarWidth + 'px'} transition="margin-left 0.3s" overflowX="hidden" maxW={sidebarWidth > 0 ? `calc(100vw - ${sidebarWidth}px)` : '100vw'}>
        <Routes>
          <Route path={'/'} element={<Navigate to="/MemberLogin" replace />} />
          <Route path={'/MemberLogin'} element={<MemberLogin onLoginSuccess={handleLoginSuccessAndNavigate} />} />
          <Route path={'/register'} element={<Register />} />
          <Route path={'/StaffLogin'} element={<StaffLogin onLoginSuccess={handleLoginSuccessAndNavigate} />} />
          <Route path={'/StaffRegister'} element={<StaffRegister />} />
          <Route path={'/set-initial-password'} element={<SetInitialPassword />} />
          <Route path={'/setup-preferences'} element={<PreferencesSetup />} />
          <Route path={'/select-topics'} element={<SelectTopicsOfInterest />} />
          <Route path={'/notification-preferences'} element={<NotificationPreferences />} />
          <Route path={'/notification-frequency'} element={<NotificationFrequency />} />
          <Route path={'/member/profile'} element={<MemberProfile />} />
          <Route path={'/landing'} element={<LoginLanding />} />
          <Route path={'/member/saved-articles'} element={<SavedArticles />} />
          <Route path={'/member/articles'} element={<MemberArticles />} />
          <Route path={'/member/articles/:id'} element={<MemberArticleDetail />} />
          <Route path={'/admin/users'} element={<UserManagement />} />
          <Route path={'/admin/member-analytics'} element={<MemberAnalytics />} />
          <Route path={'/admin/categories'} element={<CategoryManagement />} />
          <Route path={'/admin/sources'} element={<SourceManagement />} />
          <Route path={'/consultant/fetch'} element={<NewsFetchDashboard />} />
          <Route path={'/consultant/articles'} element={<ArticlesList />} />
          <Route path={'/consultant/articles/:id'} element={<ArticleReview />} />
          <Route path={'/admin/industries'} element={<IndustryManagement />} />
          <Route path={'/admin/interests'} element={<InterestManagement />} />
          <Route path={'/admin/broadcast'} element={<BroadcastManagement />} />
          <Route path={'/drafts'} element={<DraftsList />} />
          <Route path={'/message-sent'} element={<MessageSent />} />
          <Route path={'/consultant/publish-queue'} element={<PublishQueue />} />
          <Route path={'/consultant/publish/:id'} element={<PublishArticle />} />
          <Route path={'/public-articles'} element={<PublicArticles />} />
          <Route path={'/topics-of-interest'} element={<TopicsOfInterest />} />
          <Route path={'/forgot-password'} element={<ForgotPassword />} />
        </Routes>
      </Box>
    </Flex>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;