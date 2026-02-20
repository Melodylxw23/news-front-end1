import React from 'react'
import { Box, VStack, Button, Text, HStack } from '@chakra-ui/react'
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
  const [pendingInterests, setPendingInterests] = React.useState([])
  const navigate = useNavigate()

  const parseStoredJson = (key) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      console.error(`[LoginLanding] Failed to parse ${key}:`, e)
      return null
    }
  }

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

  React.useEffect(() => {
    const interests = memberProfile?.Interests || memberProfile?.interests || []
    if (interests.length > 0) return

    const pending = parseStoredJson('pendingTopicSelections')
    const pendingIds = pending?.InterestTagIds || []
    if (!pendingIds.length) return

    let cancelled = false
    const loadPending = async () => {
      try {
        const res = await fetch('/api/InterestTags')
        const data = await res.json().catch(() => null)
        const list = data?.data || []
        const nameById = new Map(
          list.map(t => [
            t.interestTagId ?? t.InterestTagId,
            t.nameEN ?? t.NameEN ?? t.name ?? t.Name
          ])
        )
        const mapped = pendingIds.map(id => ({
          interestTagId: id,
          name: nameById.get(id) || `Topic ${id}`
        }))
        if (!cancelled) setPendingInterests(mapped)
      } catch (e) {
        console.error('[LoginLanding] Error loading pending interests:', e)
      }
    }
    loadPending()
    return () => { cancelled = true }
  }, [memberProfile])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('name')
    setRole(null)
    setName('')
    navigate('/MemberLogin')
  }

  const pendingTopicSelections = parseStoredJson('pendingTopicSelections')
  const pendingNotificationPreferences = parseStoredJson('pendingNotificationPreferences')
  const pendingNotificationFrequency = parseStoredJson('pendingNotificationFrequency')

  const displayLanguage = memberProfile?.PreferredLanguage || memberProfile?.preferredLanguage || pendingTopicSelections?.PreferredLanguage
  const displayInterests = (memberProfile?.Interests?.length || memberProfile?.interests?.length)
    ? (memberProfile?.Interests || memberProfile?.interests)
    : pendingInterests
  const displayChannels = memberProfile?.NotificationChannels || memberProfile?.notificationChannels || pendingNotificationPreferences?.NotificationChannels || ''
  const displayFrequency = memberProfile?.NotificationFrequency || memberProfile?.notificationFrequency || pendingNotificationFrequency?.NotificationFrequency || ''

  const roleConfig = {
    admin: { icon: '🛡️', label: 'Administrator', color: '#1e73d1', bg: '#e6f2ff', border: '#cce5ff' },
    consultant: { icon: '💼', label: 'Consultant', color: '#e07a16', bg: '#fff4e6', border: '#ffe0cc' },
    member: { icon: '👤', label: 'Member', color: '#1e7a3a', bg: '#ecf7f0', border: '#d9eee6' }
  }
  const rc = roleConfig[role] || { icon: '❓', label: 'Unknown', color: '#666', bg: '#f5f5f5', border: '#eee' }
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'

  return (
    <Box minH="100vh" bg="#fbf8f6" p={{ base: 4, md: 10 }}>
      <Box maxW="760px" mx="auto">

        {/* Welcome Header Card */}
        <Box bg="white" boxShadow="0 8px 30px rgba(0,0,0,0.06)" borderRadius="14px" p={{ base: 5, md: 7 }} mb={5}>
          <HStack spacing={5} alignItems="center">
            <Box
              w="56px" h="56px" borderRadius="full" bg={rc.bg}
              display="flex" alignItems="center" justifyContent="center"
              border="2px solid" borderColor={rc.border} flexShrink={0}
            >
              <Text fontSize="xl" fontWeight={700} color={rc.color}>{initials}</Text>
            </Box>
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight={700} color="#111">
                {loading ? 'Detecting role…' : (name ? `Welcome back, ${name}` : 'Welcome')}
              </Text>
              {!loading && role && (
                <HStack spacing={2} mt={1}>
                  <Box
                    px={3} py="2px" borderRadius="full" fontSize="xs" fontWeight={600}
                    bg={rc.bg} color={rc.color} border="1px solid" borderColor={rc.border}
                    display="inline-flex" alignItems="center" gap="6px"
                  >
                    <Box as="span">{rc.icon}</Box>
                    {rc.label}
                  </Box>
                  {localStorage.getItem('token') && (
                    <Box
                      px={2} py="2px" borderRadius="full" fontSize="11px" fontWeight={500}
                      bg="#ecf7f0" color="#1e7a3a" border="1px solid" borderColor="#d9eee6"
                    >
                      Authenticated
                    </Box>
                  )}
                </HStack>
              )}
              {!loading && !role && (
                <Text fontSize="sm" color="#999" mt={1}>You are not currently logged in.</Text>
              )}
            </VStack>
          </HStack>
        </Box>

        {error && (
          <Box role="alert" mb={5} borderRadius="10px" bg="#fff5f5" px={4} py={3} border="1px solid" borderColor="#fed7d7">
            <HStack spacing={3}>
              <Box as="span" fontSize="16px">⚠️</Box>
              <Text fontSize="sm" color="#c53030" fontWeight={500}>{error}</Text>
            </HStack>
          </Box>
        )}

        {/* Role-specific Capabilities */}
        {!loading && role && (
          <Box bg="white" boxShadow="0 8px 30px rgba(0,0,0,0.06)" borderRadius="14px" p={{ base: 5, md: 7 }} mb={5}>
            <HStack mb={4} spacing={3}>
              <Box as="span" fontSize="20px">{rc.icon}</Box>
              <Text fontSize="md" fontWeight={700} color="#111">
                {role === 'admin' && 'Admin Capabilities'}
                {role === 'consultant' && 'Consultant Capabilities'}
                {role === 'member' && 'Member Features'}
              </Text>
              {role === 'member' && (
                <Button
                  size="sm" ml="auto"
                  bg={rc.color} color="white" borderRadius="8px" fontWeight={600} fontSize="13px"
                  _hover={{ bg: '#16652f' }}
                  onClick={() => navigate('/member/profile')}
                >
                  View Profile
                </Button>
              )}
            </HStack>

            {role === 'admin' && (
              <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr 1fr' }} gap={3}>
                {[
                  { icon: '👥', title: 'User Management', desc: 'Manage users and roles' },
                  { icon: '🔒', title: 'Account Control', desc: 'Activate / deactivate accounts' },
                  { icon: '🔗', title: 'Member Linking', desc: 'Link members to users' }
                ].map((item, i) => (
                  <Box key={i} p={4} bg="#fafafa" borderRadius="10px" border="1px solid" borderColor="#f0f0f0">
                    <Box as="span" fontSize="22px">{item.icon}</Box>
                    <Text fontSize="sm" fontWeight={600} color="#222" mt={2}>{item.title}</Text>
                    <Text fontSize="xs" color="#888" mt={1}>{item.desc}</Text>
                  </Box>
                ))}
              </Box>
            )}

            {role === 'consultant' && (
              <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={3}>
                {[
                  { icon: '📋', title: 'Client Management', desc: 'View and manage assigned clients' },
                  { icon: '📊', title: 'Dashboards & Tools', desc: 'Access consultant dashboards and analytics' }
                ].map((item, i) => (
                  <Box key={i} p={4} bg="#fafafa" borderRadius="10px" border="1px solid" borderColor="#f0f0f0">
                    <Box as="span" fontSize="22px">{item.icon}</Box>
                    <Text fontSize="sm" fontWeight={600} color="#222" mt={2}>{item.title}</Text>
                    <Text fontSize="xs" color="#888" mt={1}>{item.desc}</Text>
                  </Box>
                ))}
              </Box>
            )}

            {role === 'member' && (
              <Box display="grid" gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={3}>
                {[
                  { icon: '📰', title: 'Personalized Feed', desc: 'View news tailored to your interests' },
                  { icon: '⚙️', title: 'Preferences', desc: 'Manage your subscription and settings' }
                ].map((item, i) => (
                  <Box key={i} p={4} bg="#fafafa" borderRadius="10px" border="1px solid" borderColor="#f0f0f0">
                    <Box as="span" fontSize="22px">{item.icon}</Box>
                    <Text fontSize="sm" fontWeight={600} color="#222" mt={2}>{item.title}</Text>
                    <Text fontSize="xs" color="#888" mt={1}>{item.desc}</Text>
                  </Box>
                ))}
              </Box>
            )}

            <Text fontSize="xs" color="#aaa" mt={4}>Use the sidebar to navigate to your tools.</Text>
          </Box>
        )}

        {/* Member Preferences */}
        {role === 'member' && memberProfile && (
          <Box bg="white" boxShadow="0 8px 30px rgba(0,0,0,0.06)" borderRadius="14px" p={{ base: 5, md: 7 }}>
            <Text fontSize="md" fontWeight={700} color="#111" mb={5}>Your Preferences</Text>

            {/* Language & Topics */}
            <Box mb={4} p={4} bg="#fafafa" borderRadius="10px" border="1px solid" borderColor="#f0f0f0">
              <HStack justifyContent="space-between" alignItems="center" mb={3}>
                <HStack spacing={2}>
                  <Box as="span" fontSize="15px">🌐</Box>
                  <Text fontSize="13px" fontWeight={700} color="#555" letterSpacing="0.5px">LANGUAGE & TOPICS</Text>
                </HStack>
                <Button
                  size="xs" bg="#e07a16" color="white" borderRadius="6px" fontSize="12px" fontWeight={600}
                  _hover={{ bg: '#c46810' }} onClick={() => navigate('/select-topics')}
                >
                  Edit
                </Button>
              </HStack>

              {displayLanguage && (
                <Text fontSize="sm" color="#444" mb={2}>
                  Language: <Box as="span" fontWeight={600}>{displayLanguage}</Box>
                </Text>
              )}

              {displayInterests && displayInterests.length > 0 ? (
                <Box display="flex" flexWrap="wrap" gap={2}>
                  {displayInterests.map((interest, idx) => (
                    <Box
                      key={idx} px={3} py="3px" bg="#fff4e6" color="#e07a16"
                      borderRadius="full" fontSize="xs" fontWeight={600}
                      border="1px solid" borderColor="#ffe0cc"
                    >
                      {interest.Name || interest.name || interest.nameEN || interest.NameEN}
                    </Box>
                  ))}
                </Box>
              ) : (
                <HStack spacing={2}>
                  <Text fontSize="sm" color="#bbb" fontStyle="italic">No topics selected yet</Text>
                  <Button
                    size="xs" bg="#e07a16" color="white" borderRadius="6px" fontSize="12px" fontWeight={600}
                    _hover={{ bg: '#c46810' }} onClick={() => navigate('/select-topics')}
                  >
                    Select Topics
                  </Button>
                </HStack>
              )}
            </Box>

            {/* Notification Preferences */}
            <Box mb={4} p={4} bg="#fafafa" borderRadius="10px" border="1px solid" borderColor="#f0f0f0">
              <HStack justifyContent="space-between" alignItems="center" mb={3}>
                <HStack spacing={2}>
                  <Box as="span" fontSize="15px">🔔</Box>
                  <Text fontSize="13px" fontWeight={700} color="#555" letterSpacing="0.5px">NOTIFICATIONS</Text>
                </HStack>
                <Button
                  size="xs" bg="#1e73d1" color="white" borderRadius="6px" fontSize="12px" fontWeight={600}
                  _hover={{ bg: '#165cad' }} onClick={() => navigate('/notification-preferences')}
                >
                  Edit
                </Button>
              </HStack>

              {displayChannels ? (
                <Box display="flex" flexWrap="wrap" gap={2}>
                  {displayChannels.split(',').map((channel, idx) => (
                    <Box
                      key={idx} px={3} py="3px" bg="#e6f2ff" color="#1e73d1"
                      borderRadius="full" fontSize="xs" fontWeight={600}
                      border="1px solid" borderColor="#cce5ff"
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
                  <Text fontSize="sm" color="#bbb" fontStyle="italic">No channels configured</Text>
                  <Button
                    size="xs" bg="#1e73d1" color="white" borderRadius="6px" fontSize="12px" fontWeight={600}
                    _hover={{ bg: '#165cad' }} onClick={() => navigate('/notification-preferences')}
                  >
                    Set Up
                  </Button>
                </HStack>
              )}
            </Box>

            {/* Notification Frequency */}
            <Box p={4} bg="#fafafa" borderRadius="10px" border="1px solid" borderColor="#f0f0f0">
              <HStack justifyContent="space-between" alignItems="center" mb={3}>
                <HStack spacing={2}>
                  <Box as="span" fontSize="15px">⏱️</Box>
                  <Text fontSize="13px" fontWeight={700} color="#555" letterSpacing="0.5px">FREQUENCY</Text>
                </HStack>
                <Button
                  size="xs" bg="#1e7a3a" color="white" borderRadius="6px" fontSize="12px" fontWeight={600}
                  _hover={{ bg: '#165a2f' }} onClick={() => navigate('/notification-frequency')}
                >
                  Edit
                </Button>
              </HStack>

              {displayFrequency ? (
                <Box display="flex" flexWrap="wrap" gap={2}>
                  <Box
                    px={3} py="3px" bg="#ecf7f0" color="#1e7a3a"
                    borderRadius="full" fontSize="xs" fontWeight={600}
                    border="1px solid" borderColor="#d9eee6"
                  >
                    {(displayFrequency === 'immediate' && '⚡ Immediate') ||
                     (displayFrequency === 'daily' && '📅 Daily Digest') ||
                     (displayFrequency === 'weekly' && '📊 Weekly Digest')}
                  </Box>
                </Box>
              ) : (
                <HStack spacing={2}>
                  <Text fontSize="sm" color="#bbb" fontStyle="italic">No frequency set</Text>
                  <Button
                    size="xs" bg="#1e7a3a" color="white" borderRadius="6px" fontSize="12px" fontWeight={600}
                    _hover={{ bg: '#165a2f' }} onClick={() => navigate('/notification-frequency')}
                  >
                    Set Frequency
                  </Button>
                </HStack>
              )}
            </Box>
          </Box>
        )}

      </Box>
    </Box>
  )
}
