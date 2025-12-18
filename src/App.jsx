import './App.css';
import { Container, Box, Flex, Heading, Link as ChakraLink, Text } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Link as RouterLink } from 'react-router-dom';
import MemberLogin from './assets/pages/MemberLogin';
import StaffLogin from './assets/pages/StaffLogin';
import Register from './assets/pages/Register';


function App() {
  return (
    <Router>
        <Box as="header" bg="green.600" color="white">
          <Container maxW="container.lg">
            <Flex as="nav" align="center" gap={6} py={4}>
              <ChakraLink as={RouterLink} to="/">
                <Heading size="md">Learning</Heading>
              </ChakraLink>
              <ChakraLink as={RouterLink} to="/register"><Text>Register</Text></ChakraLink>
              <ChakraLink as={RouterLink} to="/MemberLogin"><Text>MemberLogin</Text></ChakraLink>
              <ChakraLink as={RouterLink} to="/StaffLogin"><Text>StaffLogin</Text></ChakraLink>
            </Flex>
          </Container>
        </Box>

        <Container maxW="container.lg" my={6}>
          <Routes>
            <Route path={'/'} element={<MemberLogin />} />
            <Route path={'/register'} element={<Register />} />
            <Route path={'/MemberLogin'} element={<MemberLogin />} />
            <Route path={'/StaffLogin'} element={<StaffLogin />} />
          </Routes>
        </Container>
      
    </Router>
  );
}

export default App;
