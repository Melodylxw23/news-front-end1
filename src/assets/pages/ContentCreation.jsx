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
import { useNavigate } from 'react-router-dom';
import { listArticles, getArticle } from '../../api/articles';
import { getSummary, getPoster, deleteSummary, deletePoster, deletePPT } from '../../api/contentCreation';
import { getRoleFromToken } from '../../utils/auth';

const ContentCreation = () => {
  const navigate = useNavigate();
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
  const [contentVisible, setContentVisible] = useState(false); // For animation
  const [isFirstLoad, setIsFirstLoad] = useState(true); // Track first article selection
  const [showMoreMenu, setShowMoreMenu] = useState(false); // MoreVert dropdown
  const [showDeleteAssetsDialog, setShowDeleteAssetsDialog] = useState(false); // Delete assets modal
  const [deleteSelection, setDeleteSelection] = useState({ summary: false, pdf: false, ppt: false });
  const [deletingAssets, setDeletingAssets] = useState(false);
  const [articleAssets, setArticleAssets] = useState({}); // Track which assets exist for each article

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
    setShowMoreMenu(false); // Close menu when switching articles
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
      
      // Check for saved assets
      let hasSummary = false;
      let hasPoster = false;
      
      try {
        const summaryRes = await getSummary(parseInt(id));
        hasSummary = Boolean(summaryRes?.summaryText || summaryRes?.SummaryText);
      } catch (e) {
        // No summary
      }
      
      try {
        const posterRes = await getPoster(parseInt(id));
        hasPoster = Boolean(posterRes?.pdfPath || posterRes?.PdfPath);
      } catch (e) {
        // No poster
      }
      
      setArticleAssets((prev) => ({
        ...prev,
        [id]: {
          summary: hasSummary,
          pdf: hasPoster,
          ppt: false, // TODO: Add getPPT when backend supports it
        },
      }));
      
      setGeneratedAssets((prev) => ({
        ...prev,
        [id]: {
          summary: Boolean(translated),
          pdf: prev[id]?.pdf || false,
          ppt: prev[id]?.ppt || false,
        },
      }));
      setContentView(translated ? 'translated' : 'original');
      // Only animate on first article selection
      if (isFirstLoad) {
        setTimeout(() => {
          setContentVisible(true);
          setIsFirstLoad(false);
        }, 50);
      }
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
  const currentArticleAssets = selectedArticle ? articleAssets[selectedArticle.id] || {} : {};
  const hasAnyAssets = Boolean(currentArticleAssets.summary || currentArticleAssets.pdf || currentArticleAssets.ppt);
  const hasGeneratedAssets = Boolean(selectedAssets.summary || selectedAssets.pdf || selectedAssets.ppt);

  const handleDeleteAssets = async () => {
    if (!selectedArticle) return;
    
    setDeletingAssets(true);
    try {
      const promises = [];
      
      if (deleteSelection.summary && currentArticleAssets.summary) {
        promises.push(deleteSummary(parseInt(selectedArticle.id)));
      }
      
      if (deleteSelection.pdf && currentArticleAssets.pdf) {
        promises.push(deletePoster(parseInt(selectedArticle.id)));
      }
      
      if (deleteSelection.ppt && currentArticleAssets.ppt) {
        promises.push(deletePPT(parseInt(selectedArticle.id)));
      }
      
      await Promise.all(promises);
      
      // Update local state
      setArticleAssets((prev) => ({
        ...prev,
        [selectedArticle.id]: {
          summary: deleteSelection.summary ? false : prev[selectedArticle.id]?.summary,
          pdf: deleteSelection.pdf ? false : prev[selectedArticle.id]?.pdf,
          ppt: deleteSelection.ppt ? false : prev[selectedArticle.id]?.ppt,
        },
      }));
      
      setShowDeleteAssetsDialog(false);
      setDeleteSelection({ summary: false, pdf: false, ppt: false });
      alert('Assets deleted successfully!');
    } catch (e) {
      alert('Failed to delete assets: ' + (e.message || e));
    } finally {
      setDeletingAssets(false);
    }
  };

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
    <Box bg="#f7f1ed" h="100vh" overflow="hidden" fontFamily="'Poppins', sans-serif">
      {/* CSS Keyframes for animations */}
      <style>
        {`
          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes cardEntrance {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
          .ai-card {
            transition: transform 0.25s ease, box-shadow 0.25s ease;
          }
          .ai-card.animate {
            opacity: 0;
            animation: cardEntrance 0.4s ease-out forwards;
          }
          .ai-card.animate:nth-child(1) { animation-delay: 0.05s; }
          .ai-card.animate:nth-child(2) { animation-delay: 0.1s; }
          .ai-card.animate:nth-child(3) { animation-delay: 0.15s; }
          .ai-card:hover {
            transform: translateY(-8px) scale(1.03);
            box-shadow: 0 25px 50px -15px rgba(186, 0, 6, 0.2), 0 15px 30px -10px rgba(0, 0, 0, 0.1);
          }
          .ready-btn.animate {
            opacity: 0;
            animation: cardEntrance 0.4s ease-out forwards;
            animation-delay: 0.2s;
          }
        `}
      </style>
      <Flex gap={4} align="start" h="100%">
        <Box flex="0 0 35%" pt={2} px={5} bg="#fcf6f2" h="100vh" overflowY="auto">
          <Flex justify="space-between" align="start" mb={8}>
            <VStack align="center" >
              <Text fontSize="3xl" fontWeight="1000" color="#887b76" textAlign="center" pt={2}>
                Content Creation
              </Text>
              <Text fontSize="md" color="#887b76" textAlign="center">
                Manage & summarize articles with AI tools, prepare assets for viewing
              </Text>
            </VStack>
          </Flex>

          <Flex gap={3} mb={4}>
            <Box position="relative" flex="1">
              <Box 
                position="absolute" 
                left="12px" 
                top="50%" 
                transform="translateY(-50%)" 
                pointerEvents="none"
                zIndex={1}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0a8a3" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
              </Box>
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg="white"
                border="1px solid #e0d8d3"
                borderRadius="6px"
                size="sm"
                h="36px"
                pl="36px"
                _placeholder={{ color: '#b0a8a3' }}
              />
            </Box>
            <Flex
              as="select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              w="100px"
              bg="#887b76"
              color="white"
              px={3}
              h="36px"
              borderRadius="6px"
              fontSize="sm"
              fontWeight="500"
              alignItems="center"
              border="none"
              cursor="pointer"
              sx={{
                '& option': {
                  bg: '#887b76',
                  color: 'white',
                }
              }}
            >
              <option value="newest">Sort By</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title</option>
            </Flex>
          </Flex>

          <Flex w="100%" mb={4}>
            <Button
              bg="#fcf6f2"
              flex="1"
              py={2}
              borderRadius={0}
              borderBottom={tabValue === 'active' ? '2px solid #887b76' : '2px solid transparent'}
              fontWeight={tabValue === 'active' ? 600 : 400}
              fontSize="sm"
              color={tabValue === 'active' ? '#887b76' : '#999'}
              onClick={() => setTabValue('active')}
              _hover={{ color: '#887b76' }}
            >
              Active Articles
            </Button>
            <Button
              bg="#fcf6f2"
              flex="1"
              py={2}
              borderRadius={0}
              borderBottom={tabValue === 'completed' ? '2px solid #887b76' : '2px solid transparent'}
              fontWeight={tabValue === 'completed' ? 600 : 400}
              fontSize="sm"
              color={tabValue === 'completed' ? '#887b76' : '#999'}
              onClick={() => setTabValue('completed')}
              _hover={{ color: '#887b76' }}
            >
              Completed Articles
            </Button>
          </Flex>

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

            {tabValue === 'active' && filteredArticles.map((article, index) => (
              <Box
                key={article.id}
                bg="white"
                borderRadius="12px"
                borderWidth="1px"
                borderColor={selectedArticle?.id === article.id ? '#ba0006' : '#e0d8d3'}
                overflow="hidden"
                cursor="pointer"
                onClick={() => fetchDetail(article.id, article)}
                boxShadow={selectedArticle?.id === article.id 
                  ? '0 8px 25px -5px rgba(186, 0, 6, 0.3), 0 10px 10px -5px rgba(186, 0, 6, 0.1)'
                  : '0 4px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }
                transform={selectedArticle?.id === article.id ? 'scale(1.02)' : 'scale(1)'}
                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                _hover={{
                  transform: 'translateY(-4px) scale(1.01)',
                  boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.15), 0 10px 20px -5px rgba(0, 0, 0, 0.1)',
                  borderColor: '#ba0006',
                }}
                style={{
                  animation: `slideInLeft 0.4s ease-out ${index * 0.1}s both`
                }}
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
                  <Text fontWeight="600" color="#887b76" >
                    {article.title}
                  </Text>
                </Box>
              </Box>
            ))}
          </VStack>
        </Box>

        <Box flex="1" bg="#f7f1ed" p={4} pt={5} mr={3} h="100vh" overflowY="auto" overflowX="hidden" minW="0">
          {!selectedArticle ? (
            <Flex h="100%" align="center" justify="center" mt="-25px">
              <VStack 
                spacing={0}
                animation="fadeInUp 0.6s ease-out"
              >
                <Text 
                  fontSize="2xl" 
                  fontWeight="900" 
                  color="#887b76"
                  opacity={0}
                  style={{ animation: 'fadeInUp 0.5s ease-out 0.1s forwards' }}
                >
                  Welcome back, Li Hua!
                </Text>
                <Text 
                  fontSize="2xl" 
                  fontWeight="900" 
                  color="#887b76"
                  opacity={0}
                  style={{ animation: 'fadeInUp 0.5s ease-out 0.3s forwards' }}
                >
                  Click on an article to get started
                </Text>
              </VStack>
            </Flex>
          ) : (
            <VStack 
              align="start" 
              spacing={6} 
              w="100%"
              minW="0"
              opacity={contentVisible ? 1 : 0}
              transform={contentVisible ? 'translateY(0) translateX(0)' : 'translateY(20px) translateX(10px)'}
              transition="all 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
            >
              <Box 
                w="100%"
                maxW="100%"
                minW="0"
                opacity={contentVisible ? 1 : 0}
                transform={contentVisible ? 'translateY(0)' : 'translateY(-10px)'}
                transition="all 0.4s ease-out 0.1s"
              >
                <Box
                  as="h1"
                  fontSize={getTitleFontSize(selectedArticle.title)}
                  fontWeight="700"
                  color="#887b76"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  width="100%"
                  display="block"
                  title={selectedArticle.title}
                >
                  {selectedArticle.title}
                </Box>
              </Box>

              <Box 
                w="100%"
                opacity={contentVisible ? 1 : 0}
                transform={contentVisible ? 'translateY(0)' : 'translateY(15px)'}
                transition="all 0.5s ease-out 0.2s"
              >
                <Flex justify="space-between" align="center" mb={2}>
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
                  p={3}
                  mb={2} 
                  borderRadius="12px" 
                  maxH="290px"
                  overflowY="auto"
                  border="1px solid #e8e8e8"
                  boxShadow="0 4px 15px -5px rgba(0, 0, 0, 0.08)"
                  transition="all 0.3s ease"
                  _hover={{
                    boxShadow: '0 6px 20px -7px rgba(0, 0, 0, 0.10)',
                    borderColor: '#d0c8c3',
                  }}
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
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="md" fontWeight="600" color="#887b76">
                    AI Enhancement Tools
                  </Text>
                  {hasAnyAssets && (
                    <Box position="relative">
                      <Box
                        as="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMoreMenu(!showMoreMenu);
                        }}
                        p={1}
                        borderRadius="4px"
                        cursor="pointer"
                        color="#887b76"
                        bg="transparent"
                        border="none"
                        _hover={{ bg: '#e8e4e1' }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2"/>
                          <circle cx="12" cy="12" r="2"/>
                          <circle cx="12" cy="19" r="2"/>
                        </svg>
                      </Box>
                      {showMoreMenu && (
                        <Box
                          position="absolute"
                          top="100%"
                          right={0}
                          mt={1}
                          bg="white"
                          borderRadius="8px"
                          boxShadow="0 4px 20px rgba(0,0,0,0.15)"
                          zIndex={100}
                          minW="150px"
                          overflow="hidden"
                        >
                          <Box
                            as="button"
                            w="100%"
                            p={3}
                            textAlign="left"
                            bg="transparent"
                            border="none"
                            cursor="pointer"
                            fontSize="sm"
                            color="#ba0006"
                            fontWeight="500"
                            _hover={{ bg: '#fff5f5' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMoreMenu(false);
                              setDeleteSelection({ summary: false, pdf: false, ppt: false });
                              setShowDeleteAssetsDialog(true);
                            }}
                          >
                            🗑️ Delete Assets
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                </Flex>
                <Flex gap={4} w="100%" mb={3} overflow="visible">
                  <Box 
                    className={`ai-card ${isFirstLoad && contentVisible ? 'animate' : ''}`}
                    bg="white" 
                    flex="1" 
                    p={5}
                    pb={4}
                    borderRadius="12px" 
                    textAlign="center"
                    boxShadow="0 10px 30px -10px rgba(0, 0, 0, 0.1), 0 6px 10px -5px rgba(0, 0, 0, 0.05)"
                    cursor="pointer"
                    position="relative"
                    onClick={() => navigate(`/consultant/generate-summary/${selectedArticle.id}`)}
                  >
                    {currentArticleAssets.summary ? (
                      <Flex
                        position="absolute"
                        top={3}
                        right={3}
                        w="18px"
                        h="18px"
                        borderRadius="full"
                        bg="#4caf50"
                        align="center"
                        justify="center"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </Flex>
                    ) : (
                      <Box 
                        position="absolute" 
                        top={3} 
                        right={3} 
                        w="18px" 
                        h="18px" 
                        borderRadius="full" 
                        border="2px solid #c5b8b3"
                      />
                    )}
                    <Flex justify="center" color={currentArticleAssets.summary ? '#4caf50' : '#c5b8b3'} mb={1} mt={1}>
                      {currentArticleAssets.summary ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      )}
                    </Flex>
                    <Text fontSize="xs" fontWeight="500" color={currentArticleAssets.summary ? '#4caf50' : '#9a8d88'} whiteSpace="nowrap">Generate Text Summary</Text>
                  </Box>
                  <Box 
                    className={`ai-card ${isFirstLoad && contentVisible ? 'animate' : ''}`}
                    bg="white" 
                    flex="1" 
                    p={5}
                    pb={4}
                    borderRadius="12px" 
                    textAlign="center"
                    boxShadow="0 10px 30px -10px rgba(0, 0, 0, 0.1), 0 6px 10px -5px rgba(0, 0, 0, 0.05)"
                    cursor="pointer"
                    position="relative"
                    onClick={() => navigate(`/consultant/generate-pdf/${selectedArticle.id}`)}
                  >
                    {currentArticleAssets.pdf ? (
                      <Flex
                        position="absolute"
                        top={3}
                        right={3}
                        w="18px"
                        h="18px"
                        borderRadius="full"
                        bg="#4caf50"
                        align="center"
                        justify="center"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </Flex>
                    ) : (
                      <Box 
                        position="absolute" 
                        top={3} 
                        right={3} 
                        w="18px" 
                        h="18px" 
                        borderRadius="full" 
                        border="2px solid #c5b8b3"
                      />
                    )}
                    <Flex justify="center" color={currentArticleAssets.pdf ? '#4caf50' : '#c5b8b3'} mb={1} mt={1}>
                      {currentArticleAssets.pdf ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      )}
                    </Flex>
                    <Text fontSize="xs" fontWeight="500" color={currentArticleAssets.pdf ? '#4caf50' : '#9a8d88'} whiteSpace="nowrap">Generate PDF Poster</Text>
                  </Box>
                  <Box 
                    className={`ai-card ${isFirstLoad && contentVisible ? 'animate' : ''}`}
                    bg="white" 
                    flex="1" 
                    p={5}
                    pb={4}
                    borderRadius="12px" 
                    textAlign="center"
                    boxShadow="0 10px 30px -10px rgba(0, 0, 0, 0.1), 0 6px 10px -5px rgba(0, 0, 0, 0.05)"
                    cursor="pointer"
                    position="relative"
                    onClick={() => navigate(`/consultant/generate-ppt/${selectedArticle.id}`)}
                  >
                    {currentArticleAssets.ppt ? (
                      <Flex
                        position="absolute"
                        top={3}
                        right={3}
                        w="18px"
                        h="18px"
                        borderRadius="full"
                        bg="#4caf50"
                        align="center"
                        justify="center"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </Flex>
                    ) : (
                      <Box 
                        position="absolute" 
                        top={3} 
                        right={3} 
                        w="18px" 
                        h="18px" 
                        borderRadius="full" 
                        border="2px solid #c5b8b3"
                      />
                    )}
                    <Flex justify="center" color={currentArticleAssets.ppt ? '#4caf50' : '#c5b8b3'} mb={1} mt={1}>
                      {currentArticleAssets.ppt ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                          <line x1="8" y1="21" x2="16" y2="21"/>
                          <line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                      )}
                    </Flex>
                    <Text fontSize="xs" fontWeight="500" color={currentArticleAssets.ppt ? '#4caf50' : '#9a8d88'} whiteSpace="nowrap">Generate PPT Slides</Text>
                  </Box>
                </Flex>
              </Box>

              <Button
                className={isFirstLoad && contentVisible ? 'ready-btn animate' : ''}
                w="100%"
                bg="#ba0006"
                color="white"
                size="lg"
                py={6}
                fontSize="md"
                fontWeight="700"
                borderRadius="12px"
                boxShadow="0 8px 25px -8px rgba(186, 0, 6, 0.5)"
                transition="background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease"
                _hover={{ 
                  bg: '#a00005',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 35px -10px rgba(186, 0, 6, 0.6)',
                }}
                _active={{
                  transform: 'translateY(0)',
                  boxShadow: '0 5px 15px -5px rgba(186, 0, 6, 0.4)',
                }}
                disabled={!hasGeneratedAssets}
              >
                Ready for Translation
              </Button>
            </VStack>
          )}
        </Box>
      </Flex>

      {/* Click outside to close more menu */}
      {showMoreMenu && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={99}
          onClick={() => setShowMoreMenu(false)}
        />
      )}

      {/* Delete Assets Dialog */}
      {showDeleteAssetsDialog && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="rgba(0,0,0,0.5)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1001}
        >
          <Box
            bg="white"
            p={8}
            borderRadius="16px"
            maxW="400px"
            w="90%"
            textAlign="center"
            boxShadow="0 25px 50px -12px rgba(0, 0, 0, 0.25)"
          >
            <Text fontSize="xl" fontWeight="700" color="#333" mb={3}>
              Delete Assets
            </Text>
            <Text fontSize="sm" color="#666" mb={6}>
              Select which assets to delete from this article. This action cannot be undone.
            </Text>
            
            <VStack spacing={3} align="stretch" mb={6}>
              <Flex
                as="label"
                align="center"
                gap={3}
                p={3}
                borderRadius="8px"
                border="1px solid #e0d8d3"
                cursor={currentArticleAssets.summary ? 'pointer' : 'not-allowed'}
                opacity={currentArticleAssets.summary ? 1 : 0.5}
                bg={deleteSelection.summary ? '#fff5f5' : 'white'}
                _hover={currentArticleAssets.summary ? { borderColor: '#ba0006' } : {}}
              >
                <input
                  type="checkbox"
                  checked={deleteSelection.summary}
                  disabled={!currentArticleAssets.summary}
                  onChange={(e) => setDeleteSelection(prev => ({ ...prev, summary: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#ba0006' }}
                />
                <Text fontSize="sm" color="#333" fontWeight="500">Text Summary</Text>
                {currentArticleAssets.summary && (
                  <Text fontSize="xs" color="#4caf50" ml="auto">Saved</Text>
                )}
              </Flex>
              
              <Flex
                as="label"
                align="center"
                gap={3}
                p={3}
                borderRadius="8px"
                border="1px solid #e0d8d3"
                cursor={currentArticleAssets.pdf ? 'pointer' : 'not-allowed'}
                opacity={currentArticleAssets.pdf ? 1 : 0.5}
                bg={deleteSelection.pdf ? '#fff5f5' : 'white'}
                _hover={currentArticleAssets.pdf ? { borderColor: '#ba0006' } : {}}
              >
                <input
                  type="checkbox"
                  checked={deleteSelection.pdf}
                  disabled={!currentArticleAssets.pdf}
                  onChange={(e) => setDeleteSelection(prev => ({ ...prev, pdf: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#ba0006' }}
                />
                <Text fontSize="sm" color="#333" fontWeight="500">PDF Poster</Text>
                {currentArticleAssets.pdf && (
                  <Text fontSize="xs" color="#4caf50" ml="auto">Saved</Text>
                )}
              </Flex>
              
              <Flex
                as="label"
                align="center"
                gap={3}
                p={3}
                borderRadius="8px"
                border="1px solid #e0d8d3"
                cursor={currentArticleAssets.ppt ? 'pointer' : 'not-allowed'}
                opacity={currentArticleAssets.ppt ? 1 : 0.5}
                bg={deleteSelection.ppt ? '#fff5f5' : 'white'}
                _hover={currentArticleAssets.ppt ? { borderColor: '#ba0006' } : {}}
              >
                <input
                  type="checkbox"
                  checked={deleteSelection.ppt}
                  disabled={!currentArticleAssets.ppt}
                  onChange={(e) => setDeleteSelection(prev => ({ ...prev, ppt: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#ba0006' }}
                />
                <Text fontSize="sm" color="#333" fontWeight="500">PPT Slides</Text>
                {currentArticleAssets.ppt && (
                  <Text fontSize="xs" color="#4caf50" ml="auto">Saved</Text>
                )}
              </Flex>
            </VStack>
            
            <Flex justify="center" gap={3}>
              <Button
                bg="#ba0006"
                color="white"
                px={6}
                py={2}
                borderRadius="8px"
                fontWeight="600"
                onClick={handleDeleteAssets}
                disabled={deletingAssets || (!deleteSelection.summary && !deleteSelection.pdf && !deleteSelection.ppt)}
                _hover={{ bg: '#a00005' }}
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                {deletingAssets ? 'Deleting...' : 'Delete Selected'}
              </Button>
              <Button
                variant="ghost"
                color="#999"
                px={6}
                py={2}
                borderRadius="8px"
                fontWeight="600"
                onClick={() => setShowDeleteAssetsDialog(false)}
                _hover={{ bg: '#f5f5f5' }}
              >
                Cancel
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ContentCreation;
