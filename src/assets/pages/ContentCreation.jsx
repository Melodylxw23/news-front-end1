import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
  Image,
  Select,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { listArticles, getArticle } from '../../api/articles';
import { getRoleFromToken } from '../../utils/auth';

const ContentCreation = () => {
  const [activeArticles, setActiveArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [tabValue, setTabValue] = useState('active');
  const [contentView, setContentView] = useState('translated');
  const [generatedAssets, setGeneratedAssets] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [userName, setUserName] = useState('User');
  const [sortBy, setSortBy] = useState('newest');

  const normalizeId = (a) => a?.NewsArticleId ?? a?.newsArticleId ?? a?.ArticleId ?? a?.articleId ?? a?.id ?? null;
  const normalizeTitle = (a) => a?.Title ?? a?.title ?? 'Untitled Article';
  const isTranslated = (it) => {
    if (!it) return false;
    const status = (it.TranslationStatus || it.translationStatus || it.Status || it.status || '').toString().toLowerCase();
    const approved = it.TranslationApprovedAt ?? it.translationApprovedAt ?? null;
    if (approved) return true;
    if (status.includes('approved')) return true;
    if (status.includes('translated')) return true;
    // Also check for TranslatedContent presence
    const hasTranslation = Boolean(it.TranslatedContent || it.translatedContent || it.Translated || it.translated);
    if (hasTranslation) return true;
    return false;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const name = payload.name || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 'User';
        setUserName(name);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const loadTranslated = async () => {
      setLoadingList(true);
      try {
        const res = await listArticles(1, 100, 'translated');
        const items = (res && (res.Items || res.items)) ? (res.Items || res.items) : [];
        const translated = items.map((item) => ({
          id: normalizeId(item),
          title: normalizeTitle(item),
          raw: item,
        })).filter((it) => it.id != null);
        setActiveArticles(translated);
      } catch (e) {
        alert('Failed to load translated articles: ' + (e.message || e));
      } finally {
        setLoadingList(false);
      }
    };
    loadTranslated();
  }, []);

  const fetchDetail = async (id, meta) => {
    setLoadingDetail(true);
    try {
      const res = await getArticle(id);
      const articleObj = res?.Article || res?.article || ((res && (res.NewsArticleId || res.ArticleId || res.id || res.title)) ? res : null);
      const original = res?.OriginalContent || res?.originalContent || res?.Original || res?.original || articleObj?.OriginalContent || articleObj?.originalContent || '';
      const translated = res?.TranslatedContent || res?.translatedContent || res?.Translated || res?.translated || articleObj?.TranslatedContent || articleObj?.translatedContent || '';
      setSelectedArticle({
        id,
        title: meta?.title || normalizeTitle(articleObj),
        original,
        translated,
      });
      setGeneratedAssets((prev) => ({
        ...prev,
        [id]: {
          summary: Boolean(translated),
          pdf: prev[id]?.pdf || false,
          ppt: prev[id]?.ppt || false,
        },
      }));
      setContentView(translated ? 'translated' : 'original');
    } catch (e) {
      alert('Failed to load article detail: ' + (e.message || e));
    } finally {
      setLoadingDetail(false);
    }
  };

  const displayContent = contentView === 'original'
    ? selectedArticle?.original
    : selectedArticle?.translated;

  const selectedAssets = selectedArticle ? generatedAssets[selectedArticle.id] || {} : {};
  const hasGeneratedAssets = Boolean(selectedAssets.summary || selectedAssets.pdf || selectedAssets.ppt);

  const filteredArticles = activeArticles.filter(article =>
    (article.title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTitleFontSize = (title) => {
    const len = (title || '').length;
    if (len <= 45) return '2xl';
    if (len <= 70) return 'xl';
    return 'lg';
  };

  return (
    <Box bg="#f7f1ed" h="100vh" overflow="hidden">
      <Flex gap={4} align="start" h="100%">
        <Box flex="0 0 35%" pt={2} px={3} bg="#fcf6f2" h="100vh" overflowY="auto">
          <Flex justify="space-between" align="start" mb={8}>
            <VStack align="center" >
              <Text fontSize="3xl" fontWeight="1000" color="#887b76" textAlign="center" pt={1}>
                Content Creation
              </Text>
              <Text fontSize="md" color="#887b76" textAlign="center">
                Manage & summarize articles with AI tools, prepare assets for viewing
              </Text>
            </VStack>
          </Flex>

          <Flex gap={3} mb={6}>
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              flex="1"
              bg="white"
            />
            <Box as="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} w="120px" bg="#887b76" color="white" p={2} borderRadius="4px">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title</option>
            </Box>
          </Flex>

          <Box>
            <Flex gap={0} alignItems="center" borderBottom="2px solid #e8e8e8" display="inline-flex">
              <Button
                variant="unstyled"
                px={4}
                py={2}
                borderRadius={0}
                borderBottom={tabValue === 'active' ? '3px solid #333' : '3px solid transparent'}
                fontWeight={tabValue === 'active' ? 600 : 400}
                color={tabValue === 'active' ? '#333' : '#999'}
                onClick={() => setTabValue('active')}
                _hover={{ color: '#333' }}
              >
                Active Articles
              </Button>
              <Button
                variant="unstyled"
                px={4}
                py={2}
                borderRadius={0}
                borderBottom={tabValue === 'completed' ? '3px solid #333' : '3px solid transparent'}
                fontWeight={tabValue === 'completed' ? 600 : 400}
                color={tabValue === 'completed' ? '#333' : '#999'}
                onClick={() => setTabValue('completed')}
                _hover={{ color: '#333' }}
              >
                Completed Articles
              </Button>
            </Flex>
          </Box>

          <VStack spacing={4} align="stretch" mt={4}>
            {tabValue === 'completed' && (
              <Box bg="white" p={4} borderRadius="8px" borderWidth="1px" borderColor="#e0d8d3">
                <Text color="#887b76">No completed articles yet.</Text>
              </Box>
            )}

            {tabValue === 'active' && loadingList && (
              <Box bg="white" p={4} borderRadius="8px" borderWidth="1px" borderColor="#e0d8d3">
                <Text color="#887b76">Loading translated articles...</Text>
              </Box>
            )}

            {tabValue === 'active' && !loadingList && filteredArticles.length === 0 && (
              <Box bg="white" p={4} borderRadius="8px" borderWidth="1px" borderColor="#e0d8d3">
                <Text color="#887b76">No translated articles available.</Text>
              </Box>
            )}

            {tabValue === 'active' && filteredArticles.map((article) => (
              <Box
                key={article.id}
                bg="white"
                borderRadius="8px"
                borderWidth="1px"
                borderColor={selectedArticle?.id === article.id ? '#ba0006' : '#e0d8d3'}
                overflow="hidden"
                cursor="pointer"
                onClick={() => fetchDetail(article.id, article)}
              >
                {article.raw?.Image && (
                  <Image
                    src={article.raw.Image}
                    alt={article.title}
                    w="100%"
                    h="150px"
                    objectFit="cover"
                  />
                )}
                <Box p={4}>
                  <Text fontWeight="600" color="#887b76" mb={3}>
                    {article.title}
                  </Text>
                </Box>
              </Box>
            ))}
          </VStack>
        </Box>

        <Box flex="1" bg="#f7f1ed" p={4} pt={4} h="100vh" overflowY="auto">
          {!selectedArticle ? (
            <Text color="#887b76">Select a translated article to start content creation.</Text>
          ) : (
            <VStack align="start" spacing={6} w="100%">
              <Box w="100%">
                <Text
                  fontSize={getTitleFontSize(selectedArticle.title)}
                  fontWeight="700"
                  color="#887b76"
                  noOfLines={1}
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                >
                  {selectedArticle.title}
                </Text>
              </Box>

              <Box w="100%">
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="md" fontWeight="600" color="#887b76">
                    {contentView === 'original' ? 'Original Content' : 'Translated Content'}
                  </Text>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="#ba0006"
                    fontSize="xs"
                    onClick={() => setContentView(contentView === 'original' ? 'translated' : 'original')}
                  >
                    {contentView === 'original' ? 'View Translated Content' : 'View Original Content'}
                  </Button>
                </Flex>
                <Box 
                  w="100%" 
                  bg="#fafafa" 
                  p={4} 
                  borderRadius="8px" 
                  maxH="300px"
                  overflowY="auto"
                  border="1px solid #e8e8e8"
                  css={{
                    '&::-webkit-scrollbar': {
                      width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: '#f1f1f1',
                      borderRadius: '8px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: '#c0c0c0',
                      borderRadius: '8px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                      background: '#a0a0a0',
                    },
                  }}
                >
                  <Text fontSize="sm" color="#5a5a5a" lineHeight="1.7" whiteSpace="pre-wrap">
                    {loadingDetail ? 'Loading content...' : (displayContent || 'No content available')}
                  </Text>
                </Box>
              </Box>

              <Box w="100%">
                <Text fontSize="md" fontWeight="600" color="#887b76" mb={3}>
                  AI Enhancement Tools
                </Text>
                <Flex gap={3} w="100%">
                  <Box 
                    bg="#f9f9f9" 
                    flex="1" 
                    p={4} 
                    borderRadius="12px" 
                    textAlign="center"
                    border="1px solid #e8e8e8"
                    cursor="pointer"
                    transition="all 0.2s"
                    _hover={{ bg: '#f0f0f0', transform: 'translateY(-2px)', boxShadow: 'sm' }}
                  >
                    <Text fontSize="3xl" mb={2}>📄</Text>
                    <Text fontSize="xs" fontWeight="600" color="#6a6a6a">Generate Text Summary</Text>
                  </Box>
                  <Box 
                    bg="#f9f9f9" 
                    flex="1" 
                    p={4} 
                    borderRadius="12px" 
                    textAlign="center"
                    border="1px solid #e8e8e8"
                    cursor="pointer"
                    transition="all 0.2s"
                    _hover={{ bg: '#f0f0f0', transform: 'translateY(-2px)', boxShadow: 'sm' }}
                  >
                    <Text fontSize="3xl" mb={2}>🖼️</Text>
                    <Text fontSize="xs" fontWeight="600" color="#6a6a6a">Generate PDF Poster</Text>
                    {selectedAssets.pdf && (
                      <Text mt={2} fontSize="xl" color="#4caf50">✓</Text>
                    )}
                  </Box>
                  <Box 
                    bg="#f9f9f9" 
                    flex="1" 
                    p={4} 
                    borderRadius="12px" 
                    textAlign="center"
                    border="1px solid #e8e8e8"
                    cursor="pointer"
                    transition="all 0.2s"
                    _hover={{ bg: '#f0f0f0', transform: 'translateY(-2px)', boxShadow: 'sm' }}
                  >
                    <Text fontSize="3xl" mb={2}>📊</Text>
                    <Text fontSize="xs" fontWeight="600" color="#6a6a6a">Generate PPT Slides</Text>
                    {selectedAssets.ppt && (
                      <Text mt={2} fontSize="xl" color="#4caf50">✓</Text>
                    )}
                  </Box>
                </Flex>
              </Box>

              <Button
                w="100%"
                bg="#ba0006"
                color="white"
                size="lg"
                py={6}
                fontSize="md"
                fontWeight="600"
                borderRadius="8px"
                _hover={{ bg: '#ba0006' }}
                isDisabled={!hasGeneratedAssets}
              >
                🌐 Ready for Translation
              </Button>
            </VStack>
          )}
        </Box>
      </Flex>
    </Box>
  );
};

export default ContentCreation;
