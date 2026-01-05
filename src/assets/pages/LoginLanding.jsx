import React from 'react'
import { Box, VStack, Grid, Button, Text, Image, HStack } from '@chakra-ui/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getRoleFromToken, getNameFromToken } from '../../utils/auth'

export default function LoginLanding() {
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')
  const bg = 'white'
  const [role, setRole] = React.useState(() => localStorage.getItem('role'))
  const [name, setName] = React.useState(() => localStorage.getItem('name') || '')
  const [loading, setLoading] = React.useState(false)
  const [memberProfile, setMemberProfile] = React.useState(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    // First, try to get role/name directly from token claims (fast and authoritative)
    const roleFromToken = getRoleFromToken(token)
    const nameFromToken = getNameFromToken(token)
    if (roleFromToken) {
      setRole(roleFromToken)
      localStorage.setItem('role', roleFromToken)
    }
    if (nameFromToken) {
      setName(nameFromToken)
      localStorage.setItem('name', nameFromToken)
    }

    // Still fetch /me to confirm and prefer Admin if multiple roles are present.
    setLoading(true)
    fetch('/api/UserControllers/me', { headers: { Authorization: `Bearer ${token}` } }).then(async res => {
      if (!res.ok) { setLoading(false); return }
      const data = await res.json().catch(() => null)
      setLoading(false)
      const roles = data?.Roles || []
      const rolesLower = roles.map(r => String(r).toLowerCase())
      let determined = null
      if (rolesLower.includes('admin')) determined = 'admin'
      else if (rolesLower.includes('consultant')) determined = 'consultant'
      else if (rolesLower.includes('member')) determined = 'member'
      else if (roles.length > 0) determined = String(roles[0]).toLowerCase()
      if (determined) {
        setRole(determined)
        localStorage.setItem('role', determined)
      }
      if (data?.Name) {
        setName(data.Name)
        localStorage.setItem('name', data.Name)
      }
      
      // If member, fetch their profile with interests
      if (data?.Member || data?.member) {
        const memberData = data.Member || data.member
        setMemberProfile(memberData)
      }
    }).catch(() => setLoading(false))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('name')
    setRole(null)
    setName('')
    navigate('/MemberLogin')
  }

  return (
    <Box minH="100vh" bgGradient="linear(to-b,#f7fbff,white)" p={{ base: 6, md: 12 }}>
      <Grid maxW="900px" mx="auto" templateColumns={{ base: '1fr', md: '1fr' }} gap={6}>
        <Box bg={bg} boxShadow="lg" borderRadius="12px" p={6}>
          <HStack spacing={4} alignItems="center" mb={4}>
            <Image src="/logo192.png" boxSize="48px" alt="Logo" />
            <VStack align="start" spacing={0}>
              <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight={700}>Current user</Text>
              <Text fontSize="sm" color="gray.600">This shows which role is currently authenticated</Text>
            </VStack>
          </HStack>

          {error && (
            <Box role="alert" mb={4} borderRadius="8px" bg="red.50" px={3} py={2} borderLeft="4px solid" borderColor="red.400">
              <HStack spacing={3}>
                <Box as="span" fontSize="18px">❌</Box>
                <Text fontSize="sm" color="red.700">{error}</Text>
              </HStack>
            </Box>
          )}

          <VStack spacing={4} align="start">
            {loading ? (
              <Text>Detecting logged-in role…</Text>
            ) : (
              <>
                <Text fontSize="lg" fontWeight={600}>Role: {role ? role.toUpperCase() : 'Not logged in'}</Text>
                {name && <Text fontSize="sm" color="gray.600">Name: {name}</Text>}
                <Text fontSize="sm" color="gray.600">Token: {localStorage.getItem('token') ? 'Present' : 'None'}</Text>

                {role === 'admin' && (
                  <Box mt={3} p={3} bg="gray.50" borderRadius="8px">
                    <Text fontWeight={700}>Admin access</Text>
                    <Text fontSize="sm" color="gray.600" mt={2}>As an admin you can:</Text>
                    <ul style={{ marginTop: 8, marginLeft: 18 }}>
                      <li>Manage users and roles</li>
                      <li>Activate / deactivate accounts</li>
                      <li>Link members to users</li>
                    </ul>
                    <Text fontSize="sm" color="gray.600" mt={2}>Use the sidebar to access admin tools.</Text>
                  </Box>
                )}

                {role === 'consultant' && (
                  <Box mt={3} p={3} bg="gray.50" borderRadius="8px">
                    <Text fontWeight={700}>Consultant access</Text>
                    <Text fontSize="sm" color="gray.600" mt={2}>As a consultant you can:</Text>
                    <ul style={{ marginTop: 8, marginLeft: 18 }}>
                      <li>View and manage assigned clients</li>
                      <li>Access consultant dashboards and tools</li>
                    </ul>
                    <Text fontSize="sm" color="gray.600" mt={2}>Use the sidebar to access consultant tools.</Text>
                  </Box>
                )}

                {role === 'member' && (
                  <Box mt={3} p={3} bg="gray.50" borderRadius="8px" w="100%">
                    <Text fontWeight={700}>Member access</Text>
                    <Text fontSize="sm" color="gray.600" mt={2}>As a member you can:</Text>
                    <ul style={{ marginTop: 8, marginLeft: 18 }}>
                      <li>View your personalized news feed</li>
                      <li>Manage your subscription and preferences</li>
                    </ul>
                    <Text fontSize="sm" color="gray.600" mt={2}>Use the sidebar to access member features.</Text>
                    
                    {/* Display member preferences */}
                    {memberProfile && (
                      <Box mt={4} pt={3} borderTop="1px solid" borderColor="gray.200">
                        <Text fontWeight={600} fontSize="sm" color="gray.700" mb={3}>Your Preferences</Text>
                        
                        {/* Language and Topics Section */}
                        <Box mb={3} p={3} bg="gray.50" borderRadius="8px">
                          <HStack justifyContent="space-between" alignItems="center" mb={2}>
                            <Text fontSize="xs" fontWeight={600} color="gray.500">LANGUAGE & TOPICS</Text>
                            <Button
                              size="xs"
                              colorScheme="red"
                              variant="outline"
                              onClick={() => navigate('/select-topics')}
                            >
                              ✏️ Edit
                            </Button>
                          </HStack>
                        
                          {(memberProfile.PreferredLanguage || memberProfile.preferredLanguage) && (
                            <Box mb={2}>
                              <HStack spacing={2}>
                                <Box as="span" fontSize="16px">🌐</Box>
                                <Text fontSize="sm" color="gray.700">
                                  {memberProfile.PreferredLanguage || memberProfile.preferredLanguage}
                                </Text>
                              </HStack>
                            </Box>
                          )}
                          
                          <Box>
                            {((memberProfile.Interests && memberProfile.Interests.length > 0) || 
                              (memberProfile.interests && memberProfile.interests.length > 0)) ? (
                              <Box display="flex" flexWrap="wrap" gap={2}>
                                {(memberProfile.Interests || memberProfile.interests || []).map((interest, idx) => (
                                  <Box
                                    key={idx}
                                    px={3}
                                    py={1}
                                    bg="red.50"
                                    color="red.700"
                                    borderRadius="full"
                                    fontSize="xs"
                                    fontWeight={500}
                                    border="1px solid"
                                    borderColor="red.200"
                                  >
                                    {interest.Name || interest.name}
                                  </Box>
                                ))}
                              </Box>
                            ) : (
                              <HStack spacing={2}>
                                <Text fontSize="sm" color="gray.500" fontStyle="italic">
                                  No topics selected yet
                                </Text>
                                <Button
                                  size="xs"
                                  colorScheme="red"
                                  variant="outline"
                                  onClick={() => navigate('/select-topics')}
                                >
                                  Select Topics
                                </Button>
                              </HStack>
                            )}
                          </Box>
                        </Box>

                        {/* Notification Preferences Section */}
                        <Box mb={3} p={3} bg="gray.50" borderRadius="8px">
                          <HStack justifyContent="space-between" alignItems="center" mb={2}>
                            <Text fontSize="xs" fontWeight={600} color="gray.500">NOTIFICATION PREFERENCES</Text>
                            <Button
                              size="xs"
                              colorScheme="blue"
                              variant="outline"
                              onClick={() => navigate('/notification-preferences')}
                            >
                              ✏️ Edit
                            </Button>
                          </HStack>
                          
                          {memberProfile.NotificationChannels || memberProfile.notificationChannels ? (
                            <Box display="flex" flexWrap="wrap" gap={2}>
                              {(memberProfile.NotificationChannels || memberProfile.notificationChannels || '').split(',').map((channel, idx) => (
                                <Box
                                  key={idx}
                                  px={3}
                                  py={1}
                                  bg="blue.50"
                                  color="blue.700"
                                  borderRadius="full"
                                  fontSize="xs"
                                  fontWeight={500}
                                  border="1px solid"
                                  borderColor="blue.200"
                                >
                                  {channel.trim() === 'whatsapp' && '💬 WhatsApp'}
                                  {channel.trim() === 'email' && '📧 Email'}
                                  {channel.trim() === 'sms' && '📱 SMS'}
                                  {channel.trim() === 'inApp' && '🔔 In-App'}
                                </Box>
                              ))}
                            </Box>
                          ) : (
                            <HStack spacing={2}>
                              <Text fontSize="sm" color="gray.500" fontStyle="italic">
                                No notification preferences set
                              </Text>
                              <Button
                                size="xs"
                                colorScheme="blue"
                                variant="outline"
                                onClick={() => navigate('/notification-preferences')}
                              >
                                Set Preferences
                              </Button>
                            </HStack>
                          )}
                        </Box>

                        {/* Notification Frequency Section */}
                        <Box mb={3} p={3} bg="gray.50" borderRadius="8px">
                          <HStack justifyContent="space-between" alignItems="center" mb={2}>
                            <Text fontSize="xs" fontWeight={600} color="gray.500">NOTIFICATION FREQUENCY</Text>
                            <Button
                              size="xs"
                              colorScheme="purple"
                              variant="outline"
                              onClick={() => navigate('/notification-frequency')}
                            >
                              ✏️ Edit
                            </Button>
                          </HStack>
                          
                          {memberProfile.NotificationFrequency || memberProfile.notificationFrequency ? (
                            <Box display="flex" flexWrap="wrap" gap={2}>
                              <Box
                                px={3}
                                py={1}
                                bg="purple.50"
                                color="purple.700"
                                borderRadius="full"
                                fontSize="xs"
                                fontWeight={500}
                                border="1px solid"
                                borderColor="purple.200"
                              >
                                {((memberProfile.NotificationFrequency || memberProfile.notificationFrequency) === 'immediate' && '⚡ Immediate') ||
                                 ((memberProfile.NotificationFrequency || memberProfile.notificationFrequency) === 'daily' && '📅 Daily Digest') ||
                                 ((memberProfile.NotificationFrequency || memberProfile.notificationFrequency) === 'weekly' && '📊 Weekly Digest')}
                              </Box>
                            </Box>
                          ) : (
                            <HStack spacing={2}>
                              <Text fontSize="sm" color="gray.500" fontStyle="italic">
                                No frequency set
                              </Text>
                              <Button
                                size="xs"
                                colorScheme="purple"
                                variant="outline"
                                onClick={() => navigate('/notification-frequency')}
                              >
                                Set Frequency
                              </Button>
                            </HStack>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}
              </>
            )}
          </VStack>
        </Box>
      </Grid>
    </Box>
  )
}
