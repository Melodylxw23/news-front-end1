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
import ArticlesList from './assets/pages/ArticlesList';
import ArticleTranslate from './assets/pages/ArticleTranslate';
import IndustryManagement from './assets/pages/IndustryManagement'
import InterestManagement from './assets/pages/InterestManagement'
import CategoryManagement from './assets/pages/CategoryManagement'
import UserManagement from './assets/pages/UserManagement'
import SetInitialPassword from './assets/pages/SetInitialPassword'
import SelectTopicsOfInterest from './assets/pages/SelectTopicsOfInterest'
import NotificationPreferences from './assets/pages/NotificationPreferences'
import NotificationFrequency from './assets/pages/NotificationFrequency'
import BroadcastManagement from './assets/pages/BroadcastManagement';
import DraftsList from './assets/pages/DraftsList';
import MessageSent from './assets/pages/MessageSent';
import { p, path } from 'framer-motion/client';

// Sidebar component (trimmed to use only existing pages)
function Sidebar({ isCollapsed, onToggle, isLoggedIn, onLogout, isMobile, isOpen, onClose, userRole }) {
  const location = useLocation();
  const [isLoaded, setIsLoaded] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  const slideInLeft = keyframes`
    from { transform: translateX(-100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  `;
  const fadeInUp = keyframes`
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  `;
  const slideInFromLeft = keyframes`
    from { transform: translateX(-30px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  `;
  const slideInRight = keyframes`
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  `;
  const pulse = keyframes`
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  `;

  useEffect(() => setIsLoaded(true), []);
  useEffect(() => { if (isLoaded) setAnimationKey(k => k + 1); }, [isCollapsed, isLoaded]);

  const navItemsByRole = {
    member: [
      { path: '/client-profile', label: 'Profile', icon: '👤' },
      { path: '/family-member', label: 'Family Members', icon: '👪' },
      { path: '/claims-management', label: 'Claims', icon: '💼' }
    ],
    admin: [
      { path: '/admin/users', label: 'User Management', icon: '👥' },
      { path: '/admin/categories', label: 'Category Management', icon: '🏷️' },
      { path: '/admin/fetch', label: 'News Fetch Dashboard', icon: '📰' },
      { path: '/admin/sources', label: 'Source Management', icon: '�️' },
      { path: '/admin/broadcast', label: 'Broadcast Management', icon: '📢' },
    ],
    consultant: [
      { path: '/consultant/articles', label: 'Articles', icon: '📰'},
    ]
  };

  const navItems = isLoggedIn ? (navItemsByRole[userRole] || []) : [{ path: '/login', label: 'Login', icon: '🔑' }];

  const NavButton = ({ item, index }) => {
    const isActive = location.pathname === item.path;
    return (
      <Button
        as={Link}
        to={item.path}
        title={item.label}
        variant="ghost"
        w={isCollapsed ? '48px' : '100%'}
        h="48px"
        justifyContent={isCollapsed ? 'center' : 'flex-start'}
        leftIcon={!isCollapsed ? <Box fontSize="18px" minW="20px">{item.icon}</Box> : null}
        bg={isActive ? 'rgba(255,255,255,0.1)' : 'transparent'}
        color={isActive ? 'white' : 'whiteAlpha.800'}
        fontWeight={isActive ? '600' : '400'}
        fontSize="14px"
        borderRadius="12px"
        _hover={{ bg: 'rgba(255,255,255,0.15)', transform: 'translateX(4px) scale(1.02)', transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'}}
      >
        {isCollapsed ? <Box fontSize="18px">{item.icon}</Box> : <Text ml={2}>{item.label}</Text>}
      </Button>
    );
  };

  const SidebarContent = (
    <VStack spacing={0} align="stretch" h="100vh">
      <Box px={isCollapsed ? 3 : 6} py={6} animation={isLoaded ? `${fadeInUp} 0.6s ease-out` : undefined}>
        <Flex align="center" justify="center" mb={6} position="relative" mt={2}>
          {!isMobile && (
            <IconButton
              icon={<Box fontSize="13px" color="whiteAlpha.900">{isCollapsed ? '←' : '→'}</Box>}
              variant="ghost"
              size="sm"
              onClick={onToggle}
              borderRadius="8px"
              position="absolute"
              top="-10px"
              right={isCollapsed ? '2' : '0'}
              zIndex="2"
            />
          )}

          {!isCollapsed && (
            <VStack align="center" spacing={2} w="100%" animation={isLoaded ? `${slideInLeft} 0.8s ease-out 0.2s both` : undefined}>
              <Flex align="center" gap={3}>
                <Box w="70px" h="70px" borderRadius="10px" display="flex" alignItems="center" justifyContent="center" boxShadow="md">
                  <Image src="/logo192.png" alt="Logo" boxSize="60px" />
                </Box>
              </Flex>
              <Text fontSize="4xl" fontWeight="700">FINSYNC</Text>
              <Text fontSize="2xs" color="whiteAlpha.700">Your Portfolio, Perfectly Prepared</Text>
            </VStack>
          )}
        </Flex>
      </Box>

      <Box flex="1" position="relative">
        <Separator borderColor="whiteAlpha.200" animation={isLoaded ? `${slideInRight} 0.8s ease-out 0.4s both` : undefined} />
        <Box px={isCollapsed ? 2 : 4} py={2} animation={isLoaded ? `${fadeInUp} 0.8s ease-out 0.6s both` : undefined}>
          {!isCollapsed && <Text fontSize="xs" fontWeight="600" color="whiteAlpha.600" mb={4}>Navigation</Text>}
          <VStack spacing={2} align={isCollapsed ? 'center' : 'stretch'}>
            {navItems.map((item, index) => (
              <Box key={`${item.path}-${animationKey}`} animation={isLoaded && !isCollapsed ? `${slideInFromLeft} 0.4s ease-out ${0.1 + index * 0.08}s both` : undefined} w="100%">
                <NavButton item={item} index={index} />
              </Box>
            ))}
            {isLoggedIn && (
              <Box w="100%" display="flex" justifyContent={isCollapsed ? 'center' : 'stretch'} mt={2}>
                <Button variant="ghost" size="sm" w={isCollapsed ? '48px' : '100%'} h="48px" onClick={onLogout} color="whiteAlpha.700">{isCollapsed ? <Box>🚪</Box> : 'Logout'}</Button>
              </Box>
            )}
          </VStack>
        </Box>
      </Box>

      <Box px={isCollapsed ? 2 : 4} py={4}>
        <Separator borderColor="whiteAlpha.200" mb={4} />
        <Box px={2}><Text fontSize="xs" color="whiteAlpha.500" textAlign="center">© 2025 FinSync</Text></Box>
      </Box>
    </VStack>
  );

  if (isMobile) {
    return (
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
          <DrawerBackdrop />
          <DrawerContent maxW="72vw" bg="linear-gradient(135deg, #1a2332 0%, #16244c 100%)">
            <DrawerBody p={0}>{SidebarContent}</DrawerBody>
          </DrawerContent>
        </Drawer>
    );
  }

  return (
    <Box w={isCollapsed ? '72px' : '280px'} bg="linear-gradient(135deg, #1a2332 0%, #16244c 100%)" color="white" minH="100vh" position="fixed" top={0} left={0} zIndex={1000} transition="all 0.4s">
      {SidebarContent}
    </Box>
  );

  return (
    <Box w={isCollapsed ? '72px' : '280px'} bg="linear-gradient(135deg, #1a2332 0%, #16244c 100%)" color="white" minH="100vh" position="fixed" top={0} left={0} zIndex={1000} transition="all 0.4s">
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('role') || 'client');

  const authPaths = ['/login', '/MemberLogin', '/StaffLogin', '/register', '/StaffRegister', '/forgot-password'];
  const isAuthPage = authPaths.includes(location.pathname) || location.pathname.startsWith('/reset-password');
  const showSidebar = isLoggedIn && !isAuthPage;

  useEffect(() => {
    const handleStorage = () => { setIsLoggedIn(!!localStorage.getItem('token')); setUserRole(localStorage.getItem('role') || 'client'); };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLoginSuccess = (role) => { setIsLoggedIn(true); setUserRole(role); };
  // navigate to landing after login
  const navigate = useNavigate();
  const handleLoginSuccessAndNavigate = (role) => { setIsLoggedIn(true); setUserRole(role); navigate('/landing'); };
  const toggleSidebar = () => { setSidebarCollapsed(s => { const nv = !s; localStorage.setItem('sidebarCollapsed', JSON.stringify(nv)); return nv; }); };
  const handleLogout = () => { localStorage.removeItem('token'); setIsLoggedIn(false); navigate('/MemberLogin'); };

  const isMobile = useBreakpointValue({ base: true, md: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarWidth = showSidebar ? (isMobile ? 0 : (sidebarCollapsed ? 72 : 280)) : 0;

  return (
    <Flex minH="100vh" w="100vw" bgGradient="linear(to-b,rgb(198, 221, 255), #ffffff)" overflowX="hidden">
      {showSidebar && (
        <>
          {isMobile && <IconButton icon={<Box fontSize="2xl">☰</Box>} variant="ghost" position="fixed" top="16px" left="16px" zIndex="1500" onClick={() => setSidebarOpen(true)} aria-label="Open menu" />}
          {isMobile ? (
            sidebarOpen && <Sidebar isCollapsed={false} onToggle={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} isMobile={true} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} userRole={userRole} />
          ) : (
            <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} isLoggedIn={isLoggedIn} onLogout={handleLogout} isMobile={false} isOpen={false} onClose={() => {}} userRole={userRole} />
          )}
        </>
      )}

      <Box flex="1" p={isAuthPage ? 0 : 0} minH="100vh" ml={!isMobile && showSidebar ? sidebarWidth + 'px' : 0} transition="margin-left 0.3s" overflowX="hidden" maxW={!isMobile && showSidebar ? `calc(100vw - ${sidebarWidth}px)` : '100vw'}>
        <Routes>
          <Route path={'/'} element={<Navigate to="/MemberLogin" replace />} />
          <Route path={'/MemberLogin'} element={<MemberLogin onLoginSuccess={handleLoginSuccessAndNavigate} />} />
          <Route path={'/register'} element={<Register />} />
          <Route path={'/StaffLogin'} element={<StaffLogin onLoginSuccess={handleLoginSuccessAndNavigate} />} />
          <Route path={'/StaffRegister'} element={<StaffRegister />} />
          <Route path={'/set-initial-password'} element={<SetInitialPassword />} />
          <Route path={'/select-topics'} element={<SelectTopicsOfInterest />} />
          <Route path={'/notification-preferences'} element={<NotificationPreferences />} />
          <Route path={'/notification-frequency'} element={<NotificationFrequency />} />
          <Route path={'/landing'} element={<LoginLanding />} />
          <Route path={'/admin/users'} element={<UserManagement />} />
          <Route path={'/admin/categories'} element={<CategoryManagement />} />
          <Route path={'/admin/sources'} element={<SourceManagement />} />
          <Route path={'/admin/fetch'} element={<NewsFetchDashboard />} />
          <Route path={'/consultant/articles'} element={<ArticlesList />} />
          <Route path={'/consultant/articles/:id'} element={<ArticleTranslate />} />
          <Route path={'/admin/industries'} element={<IndustryManagement />} />
          <Route path={'/admin/interests'} element={<InterestManagement />} />
          <Route path={'/admin/broadcast'} element={<BroadcastManagement />} />
          <Route path={'/drafts'} element={<DraftsList />} />
          <Route path={'/message-sent'} element={<MessageSent />} />
        </Routes>
      </Box>
    </Flex>
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
