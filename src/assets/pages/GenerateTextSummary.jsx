import {
  Box,
  Button,
  Flex,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getArticle } from '../../api/articles';
import { generateSummary, getSummary, saveSummary, deleteSummary } from '../../api/contentCreation';

const GenerateTextSummary = () => {
  const navigate = useNavigate();
  const { articleId } = useParams();
  
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState('');
  const [originalSummary, setOriginalSummary] = useState(''); // Track original to detect changes
  const [summaryId, setSummaryId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false); // Unsaved changes dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false); // Delete confirmation dialog
  const [deleting, setDeleting] = useState(false);
  
  // Settings
  const [summaryLength, setSummaryLength] = useState(50);
  const [style, setStyle] = useState('professional');
  const [customKeyPoints, setCustomKeyPoints] = useState('');

  useEffect(() => {
    const fetchArticleAndSummary = async () => {
      try {
        // Fetch article
        const res = await getArticle(articleId);
        const articleObj = res?.Article || res?.article || res;
        const title = articleObj?.Title || articleObj?.title || 'Untitled Article';
        const translated = res?.TranslatedContent || res?.translatedContent || articleObj?.TranslatedContent || articleObj?.translatedContent || '';
        setArticle({ id: articleId, title, content: translated });
        
        // Fetch saved summary if exists
        try {
          const savedSummary = await getSummary(parseInt(articleId));
          if (savedSummary) {
            // Store the summaryId for later use when saving
            setSummaryId(savedSummary?.summaryId || savedSummary?.SummaryId || savedSummary?.id || savedSummary?.Id);
            
            // Get the summary text
            const text = savedSummary?.summaryText || savedSummary?.SummaryText;
            if (text) {
              setSummary(text);
              setOriginalSummary(text); // Store original for change detection
            }
          }
        } catch (summaryError) {
          // No saved summary yet, that's fine
          console.log('No saved summary found');
        }
      } catch (e) {
        alert('Failed to load article: ' + (e.message || e));
      } finally {
        setLoading(false);
      }
    };
    fetchArticleAndSummary();
  }, [articleId]);

  const handleGenerateSummary = async () => {
    setGenerating(true);
    try {
      // Build custom prompt - ALWAYS include style and length
      let promptParts = [];
      
      // Add length instruction
      if (summaryLength <= 30) {
        promptParts.push('Generate a very brief and concise summary (2-3 sentences)');
      } else if (summaryLength <= 50) {
        promptParts.push('Generate a short summary (1 paragraph, about 4-5 sentences)');
      } else if (summaryLength <= 70) {
        promptParts.push('Generate a medium-length summary (2 paragraphs)');
      } else {
        promptParts.push('Generate a detailed and comprehensive summary (3-4 paragraphs)');
      }
      
      // Add style instruction
      switch (style) {
        case 'casual':
          promptParts.push('Use a casual, conversational tone that is easy to read');
          break;
        case 'academic':
          promptParts.push('Use an academic, formal tone with precise language');
          break;
        case 'simple':
          promptParts.push('Use simple language that anyone can understand, avoid jargon');
          break;
        default: // professional
          promptParts.push('Use a professional, business-appropriate tone');
      }
      
      // Add custom key points if provided
      if (customKeyPoints.trim()) {
        promptParts.push(`Focus specifically on these key points: ${customKeyPoints}`);
      }
      
      const customPrompt = promptParts.join('. ') + '.';
      const res = await generateSummary(parseInt(articleId), customPrompt);
      
      // Store the summaryId from the response for later saving
      const newSummaryId = res?.summary?.summaryId || res?.summary?.SummaryId || res?.summary?.id || res?.summary?.Id || res?.summaryId || res?.SummaryId;
      if (newSummaryId) {
        setSummaryId(newSummaryId);
      }
      
      // Extract summary text from response
      const summaryText = res?.summary?.summaryText || res?.summary?.SummaryText || res?.summary || '';
      setSummary(typeof summaryText === 'string' ? summaryText : JSON.stringify(summaryText));
    } catch (e) {
      alert('Failed to generate summary: ' + (e.message || e));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!summary.trim()) {
      alert('No summary to save');
      return;
    }
    
    if (!summaryId) {
      alert('No summary record found. Please generate a summary first.');
      return;
    }
    
    setSaving(true);
    try {
      await saveSummary(summaryId, summary);
      setOriginalSummary(summary); // Update original after successful save
      alert('Summary saved successfully!');
    } catch (e) {
      alert('Failed to save summary: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return summary !== originalSummary && summary.trim() !== '';
  };

  // Handle back navigation with unsaved changes check
  const handleBackClick = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedDialog(true);
    } else {
      navigate('/consultant/content-creation');
    }
  };

  // Handle save from dialog and navigate back
  const handleSaveAndGoBack = async () => {
    if (!summaryId) {
      alert('No summary record found. Please generate a summary first.');
      return;
    }
    
    setSaving(true);
    try {
      await saveSummary(summaryId, summary);
      setOriginalSummary(summary);
      setShowUnsavedDialog(false);
      navigate('/consultant/content-creation');
    } catch (e) {
      alert('Failed to save summary: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    alert('Copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${articleId}.txt`;
    a.click();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSummary(parseInt(articleId));
      setSummary('');
      setOriginalSummary('');
      setSummaryId(null);
      setShowDeleteDialog(false);
      alert('Summary deleted successfully!');
    } catch (e) {
      alert('Failed to delete summary: ' + (e.message || e));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box bg="#f7f1ed" h="100vh" p={6} fontFamily="'Poppins', sans-serif">
        <Box as="p" color="#887b76">Loading article...</Box>
      </Box>
    );
  }

  return (
    <Box bg="#f7f1ed" h="100vh" overflow="auto" fontFamily="'Poppins', sans-serif" p={6}>
      {/* Back Link */}
      <Flex 
        align="center" 
        gap={2} 
        mb={4} 
        cursor="pointer" 
        onClick={handleBackClick}
        color="#ba0006"
        fontSize="sm"
        fontWeight="500"
      >
        <Box as="span">←</Box>
        <Box as="span">Back to Content Creation</Box>
      </Flex>

      {/* Title */}
      <Box as="h1" fontSize="2xl" fontWeight="700" color="#887b76" mb={6}>
        {article?.title}
      </Box>

      {/* Tab Navigation */}
      <Flex gap={4} mb={6}>
        <Button
          bg="#887b76"
          color="white"
          borderRadius="8px"
          flex="1"
          py={3}
          fontSize="sm"
          fontWeight="500"
          _hover={{ bg: '#746862' }}
        >
          📄 Generate Text Summary
        </Button>
        <Button
          bg="#efe8e3"
          color="#887b76"
          borderRadius="8px"
          flex="1"
          py={3}
          fontSize="sm"
          fontWeight="500"
          border="1px solid #887b76"
          onClick={() => navigate(`/consultant/generate-pdf/${articleId}`)}
          _hover={{ bg: '#f5f0ed' }}
        >
          🖼️ Generate PDF Poster
        </Button>
        <Button
          bg="#efe8e3"
          color="#887b76"
          borderRadius="8px"
          flex="1"
          py={3}
          fontSize="sm"
          fontWeight="500"
          border="1px solid #887b76"
          onClick={() => navigate(`/consultant/generate-ppt/${articleId}`)}
          _hover={{ bg: '#f5f0ed' }}
        >
          📊 Generate PPT Slides
        </Button>
      </Flex>

      {/* Main Content */}
      <Flex gap={6}>
        {/* Left Column - Article Content */}
        <Box flex="1.5">
          <Flex justify="space-between" align="center" mb={3}>
            <Box as="span" fontSize="md" fontWeight="600" color="#887b76">
              Translated Article Content
            </Box>
            <Box as="span" color="#999" cursor="pointer">⋮</Box>
          </Flex>
          <Box
            bg="white"
            p={5}
            borderRadius="12px"
            border="1px solid #e8e8e8"
            maxH="630px"
            overflowY="auto"
          >
            <Box as="p" fontSize="sm" color="#5a5a5a" lineHeight="1.8" whiteSpace="pre-wrap">
              {article?.content || 'No content available'}
            </Box>
          </Box>
        </Box>

        {/* Right Column - Settings & Output */}
        <Box flex="1" maxW="320px">
          <Flex direction="column" gap={5}>
            {/* Summary Length */}
            <Box>
              <Flex justify="space-between" align="center" mb={2}>
                <Box as="span" fontSize="sm" fontWeight="600" color="#ba0006">
                  Summary Length
                </Box>
                <Box as="span" fontSize="sm" fontWeight="600" color="#ba0006">
                  {summaryLength}%
                </Box>
              </Flex>
              <Flex align="center" gap={3}>
                <Box as="span" fontSize="xs" color="#666">Short</Box>
                <Box flex="1">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={summaryLength}
                    onChange={(e) => setSummaryLength(parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      appearance: 'none',
                      background: `linear-gradient(to right, #ba0006 0%, #ba0006 ${(summaryLength - 10) / 90 * 100}%, #e0d8d3 ${(summaryLength - 10) / 90 * 100}%, #e0d8d3 100%)`,
                      cursor: 'pointer'
                    }}
                  />
                </Box>
                <Box as="span" fontSize="xs" color="#666">Long</Box>
              </Flex>
            </Box>

            {/* Style */}
            <Box>
              <Box as="label" fontSize="sm" fontWeight="600" color="#ba0006" mb={2} display="block">
                Style
              </Box>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e0d8d3',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="academic">Academic</option>
                <option value="simple">Simple</option>
              </select>
            </Box>

            {/* Custom Key Points */}
            <Box>
              <Box as="label" fontSize="sm" fontWeight="600" color="#ba0006" mb={2} display="block">
                Custom Key Points (Optional)
              </Box>
              <textarea
                placeholder="Enter specific keywords or phrases the summary should focus on, separated by commas"
                value={customKeyPoints}
                onChange={(e) => setCustomKeyPoints(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  border: '1px solid #e0d8d3',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </Box>

            {/* Generate Button */}
            <Button
              bg="#ba0006"
              color="white"
              borderRadius="8px"
              py={5}
              fontSize="sm"
              fontWeight="600"
              onClick={handleGenerateSummary}
              disabled={generating}
              _hover={{ bg: '#a00005' }}
            >
              {generating ? 'Generating...' : '✨ Generate Text Summary'}
            </Button>

            {/* Output Section */}
            {summary && (
              <>
                <Flex justify="space-between" align="center">
                  <Flex gap={2}>
                    <Button size="xs" variant="ghost" onClick={handleCopy} title="Copy">📋</Button>
                    <Button 
                      size="xs" 
                      variant="ghost" 
                      onClick={() => setIsEditing(!isEditing)}
                      title={isEditing ? 'Done Editing' : 'Edit'}
                      bg={isEditing ? '#e8f5e9' : '#fff5f5'}
                    >
                      {isEditing ? '✓' : '✏️'}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={handleDownload} title="Download">⬇️</Button>
                    {originalSummary && (
                      <Button 
                        size="xs" 
                        variant="ghost" 
                        onClick={() => setShowDeleteDialog(true)} 
                        title="Delete"
                        color="#ba0006"
                        _hover={{ bg: '#fff5f5' }}
                      >
                        🗑️
                      </Button>
                    )}
                  </Flex>
                </Flex>
                
                {isEditing ? (
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={8}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'white',
                      border: '2px solid #ba0006',
                      borderRadius: '8px',
                      fontSize: '14px',
                      lineHeight: '1.7',
                      color: '#5a5a5a',
                      resize: 'vertical'
                    }}
                  />
                ) : (
                  <Box
                    bg="white"
                    p={4}
                    borderRadius="8px"
                    border="1px solid #e8e8e8"
                    maxH="200px"
                    overflowY="auto"
                  >
                    <Box as="p" fontSize="sm" color="#5a5a5a" lineHeight="1.7">
                      {summary}
                    </Box>
                  </Box>
                )}

                {/* Save Button */}
                <Button
                  bg="#ba0006"
                  color="white"
                  borderRadius="8px"
                  py={5}
                  fontSize="sm"
                  fontWeight="600"
                  onClick={handleSave}
                  disabled={saving}
                  _hover={{ bg: '#a00005' }}
                >
                  {saving ? 'Saving...' : '💾 Save'}
                </Button>
              </>
            )}
          </Flex>
        </Box>
      </Flex>

      {/* Unsaved Changes Dialog */}
      {showUnsavedDialog && (
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
            <Box as="h2" fontSize="xl" fontWeight="700" color="#333" mb={3}>
              Save changes?
            </Box>
            <Box as="p" fontSize="sm" color="#666" mb={6}>
              Your changes will be lost if you don't save them!
            </Box>
            <Flex justify="center" gap={3}>
              <Button
                bg="#ba0006"
                color="white"
                px={6}
                py={2}
                borderRadius="8px"
                fontWeight="600"
                onClick={handleSaveAndGoBack}
                disabled={saving}
                _hover={{ bg: '#a00005' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outline"
                borderColor="#666"
                color="#666"
                px={6}
                py={2}
                borderRadius="8px"
                fontWeight="600"
                onClick={() => {
                  setShowUnsavedDialog(false);
                  navigate('/consultant/content-creation');
                }}
                _hover={{ bg: '#f5f5f5' }}
              >
                Don't Save
              </Button>
              <Button
                variant="ghost"
                color="#999"
                px={6}
                py={2}
                borderRadius="8px"
                fontWeight="600"
                onClick={() => setShowUnsavedDialog(false)}
                _hover={{ bg: '#f5f5f5' }}
              >
                Cancel
              </Button>
            </Flex>
          </Box>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
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
            <Box as="h2" fontSize="xl" fontWeight="700" color="#333" mb={3}>
              Delete Summary?
            </Box>
            <Box as="p" fontSize="sm" color="#666" mb={6}>
              This action cannot be undone. The saved summary will be permanently deleted.
            </Box>
            <Flex justify="center" gap={3}>
              <Button
                bg="#ba0006"
                color="white"
                px={6}
                py={2}
                borderRadius="8px"
                fontWeight="600"
                onClick={handleDelete}
                disabled={deleting}
                _hover={{ bg: '#a00005' }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
              <Button
                variant="ghost"
                color="#999"
                px={6}
                py={2}
                borderRadius="8px"
                fontWeight="600"
                onClick={() => setShowDeleteDialog(false)}
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

export default GenerateTextSummary;
