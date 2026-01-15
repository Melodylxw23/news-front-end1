import {
  Box,
  Button,
  Flex,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getArticle } from '../../api/articles';
import { generatePDF, getPoster, savePoster } from '../../api/contentCreation';

const GeneratePDFPoster = () => {
  const navigate = useNavigate();
  const { articleId } = useParams();
  
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedPoster, setGeneratedPoster] = useState(null);
  const [originalPoster, setOriginalPoster] = useState(null); // Track saved poster
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false); // Unsaved changes dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Settings
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [orientation, setOrientation] = useState('portrait');
  const [colorPalette, setColorPalette] = useState('#1a7f5a');
  const [fontPreset, setFontPreset] = useState('modern-sans');
  const [customKeyPoints, setCustomKeyPoints] = useState('');
  const [size, setSize] = useState('A4');
  const [viewMode, setViewMode] = useState('grid');

  const templates = [
    { id: 1, name: 'Template 1', preview: '/templates/poster1.png' },
    { id: 2, name: 'Template 2', preview: '/templates/poster2.png' },
    { id: 3, name: 'Template 3', preview: '/templates/poster3.png' },
    { id: 4, name: 'Template 4', preview: '/templates/poster4.png' },
  ];

  const colorOptions = ['#1a7f5a', '#e0e0e0', '#2196f3', '#ffc107'];

  const versionHistory = [
    { id: 1, name: 'Impact Of Chi...', date: '2024-01-15' },
    { id: 2, name: "China's Strate...", date: '2024-01-14' },
  ];

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await getArticle(articleId);
        const articleObj = res?.Article || res?.article || res;
        const title = articleObj?.Title || articleObj?.title || 'Untitled Article';
        const translated = res?.TranslatedContent || res?.translatedContent || articleObj?.TranslatedContent || articleObj?.translatedContent || '';
        setArticle({ id: articleId, title, content: translated });
        
        // Also fetch any saved poster
        try {
          const posterRes = await getPoster(parseInt(articleId));
          if (posterRes) {
            let pdfPath = posterRes?.pdfPath || posterRes?.PdfPath || posterRes?.filePath || posterRes?.FilePath || '';
            if (pdfPath) {
              pdfPath = pdfPath.replace(/\\/g, '/');
              const apiBase = import.meta.env.VITE_API_BASE || 'https://localhost:7191';
              const posterUrl = pdfPath.startsWith('http') ? pdfPath : 
                               pdfPath.startsWith('/') ? `${apiBase}${pdfPath}` : `${apiBase}/${pdfPath}`;
              setGeneratedPoster(posterUrl);
              setOriginalPoster(posterUrl);
            }
          }
        } catch (posterErr) {
          // No saved poster, that's fine
          console.log('No saved poster found:', posterErr.message);
        }
      } catch (e) {
        alert('Failed to load article: ' + (e.message || e));
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [articleId]);

  const handleGeneratePoster = async () => {
    setGenerating(true);
    try {
      // Build template name and custom prompt
      const templateName = templates.find(t => t.id === selectedTemplate)?.name || 'Template 1';
      const customPrompt = customKeyPoints ? `Focus on: ${customKeyPoints}` : null;
      
      const res = await generatePDF(parseInt(articleId), templateName, customPrompt);
      
      // Debug: log the response to see what backend returns
      console.log('PDF Generation Response:', res);
      
      // Handle different response formats
      let posterUrl = null;
      
      // Check for direct URL/path
      let pdfPath = res?.pdfPath || res?.PdfPath || res?.filePath || res?.FilePath ||
                    res?.imagePath || res?.ImagePath || res?.posterUrl || res?.PosterUrl || 
                    res?.url || res?.Url || res?.path || res?.Path || '';
      
      if (pdfPath) {
        // Replace backslashes with forward slashes (Windows paths)
        pdfPath = pdfPath.replace(/\\/g, '/');
        
        // If it's already a full URL, use it directly
        if (pdfPath.startsWith('http')) {
          posterUrl = pdfPath;
        } else {
          // Build the full URL
          const apiBase = import.meta.env.VITE_API_BASE || 'https://localhost:7191';
          
          // If path starts with /, use it directly with base
          if (pdfPath.startsWith('/')) {
            posterUrl = `${apiBase}${pdfPath}`;
          } else {
            // Otherwise, add / prefix (files are usually served from wwwroot)
            posterUrl = `${apiBase}/${pdfPath}`;
          }
        }
      }
      
      // Check for base64 data
      if (!posterUrl && (res?.base64 || res?.Base64 || res?.imageData || res?.ImageData)) {
        const base64Data = res?.base64 || res?.Base64 || res?.imageData || res?.ImageData;
        posterUrl = `data:image/png;base64,${base64Data}`;
      }
      
      console.log('Constructed poster URL:', posterUrl);
      
      if (posterUrl) {
        setGeneratedPoster(posterUrl);
      } else {
        alert('Poster generated but no file URL was returned. Check console for response details.');
      }
    } catch (e) {
      alert('Failed to generate poster: ' + (e.message || e));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (shouldNavigate = true) => {
    if (!generatedPoster) {
      alert('No poster to save!');
      return;
    }
    
    try {
      // Extract the relative path from the full URL
      const apiBase = import.meta.env.VITE_API_BASE || 'https://localhost:7191';
      let relativePath = generatedPoster.replace(apiBase, '').replace(/^\//, '');
      
      await savePoster(parseInt(articleId), relativePath);
      setOriginalPoster(generatedPoster); // Update original after save
      alert('Poster saved!');
      if (shouldNavigate) {
        navigate('/consultant/content-creation');
      }
    } catch (e) {
      alert('Failed to save poster: ' + (e.message || e));
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = generatedPoster && generatedPoster !== originalPoster;

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      navigate('/consultant/content-creation');
    }
  };

  const handleSaveAndGoBack = async () => {
    setShowUnsavedDialog(false);
    await handleSave(true); // Save and navigate
  };

  const handleDiscardChanges = () => {
    setShowUnsavedDialog(false);
    // Just navigate without saving anything
    navigate('/consultant/content-creation');
  };

  const handleCancelDialog = () => {
    setShowUnsavedDialog(false);
    // Stay on the page - don't navigate
  };

  const handleExport = () => {
    // TODO: Export/download the PDF
    alert('Exporting PDF...');
  };

  const handleImport = () => {
    // TODO: Import existing design
    alert('Import feature coming soon');
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
          bg="#efe8e3"
          color="#887b76"
          borderRadius="8px"
          flex="1"
          py={3}
          fontSize="sm"
          fontWeight="500"
          border="1px solid #887b76"
          onClick={() => navigate(`/consultant/generate-summary/${articleId}`)}
          _hover={{ bg: '#f5f0ed' }}
        >
          📄 Generate Text Summary
        </Button>
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

      {/* Main Content - 3 Columns */}
      <Flex gap={5}>
        {/* Left Column - Templates */}
        <Box w="180px">
          <Box as="span" fontSize="sm" fontWeight="600" color="#ba0006" mb={3} display="block">
            Templates
          </Box>
          <Flex direction="column" gap={3}>
            {templates.map((template) => (
              <Box
                key={template.id}
                border={selectedTemplate === template.id ? '2px solid #ba0006' : '1px solid #e0d8d3'}
                borderRadius="8px"
                p={2}
                cursor="pointer"
                onClick={() => setSelectedTemplate(template.id)}
                bg="white"
              >
                <Box bg="#f5f5f5" h="80px" borderRadius="4px" mb={2} />
                <Box as="span" fontSize="xs" color="#666" textAlign="center" display="block">
                  {template.name}
                </Box>
              </Box>
            ))}
          </Flex>
          
          <Button
            variant="ghost"
            size="sm"
            color="#ba0006"
            mt={3}
            w="100%"
          >
            + Browse More
          </Button>

          {/* Size */}
          <Box mt={4}>
            <Box as="label" fontSize="sm" fontWeight="600" color="#333" mb={2} display="block">
              Size
            </Box>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: 'white',
                border: '1px solid #e0d8d3',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="Letter">Letter</option>
            </select>
          </Box>

          {/* Images Upload */}
          <Box mt={4}>
            <Box as="label" fontSize="sm" fontWeight="600" color="#333" mb={2} display="block">
              Images
            </Box>
            <Box
              border="2px dashed #e0d8d3"
              borderRadius="8px"
              p={4}
              textAlign="center"
              bg="white"
            >
              <Box as="span" fontSize="2xl" color="#999" mb={2} display="block">☁️</Box>
              <Box as="span" fontSize="xs" color="#666">
                Drag & Drop or <Box as="span" color="#ba0006" cursor="pointer">Upload Image</Box>
              </Box>
            </Box>
            <Flex mt={2} gap={2}>
              <Button size="xs" variant="outline" borderRadius="4px">✂️</Button>
              <Button size="xs" variant="outline" borderRadius="4px">🔄</Button>
              <Button size="xs" variant="outline" borderRadius="4px">+</Button>
            </Flex>
          </Box>
        </Box>

        {/* Middle Column - Preview */}
        <Box flex="1">
          {/* View Mode Tabs */}
          <Flex gap={2} mb={4}>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'solid' : 'outline'}
              bg={viewMode === 'grid' ? '#f5f5f5' : 'white'}
              onClick={() => setViewMode('grid')}
              fontSize="xs"
            >
              ⊞ Grid
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'single' ? 'solid' : 'outline'}
              bg={viewMode === 'single' ? '#f5f5f5' : 'white'}
              onClick={() => setViewMode('single')}
              fontSize="xs"
            >
              ☰ Single column
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'two' ? 'solid' : 'outline'}
              bg={viewMode === 'two' ? '#f5f5f5' : 'white'}
              onClick={() => setViewMode('two')}
              fontSize="xs"
            >
              ⊟ Two-column
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              fontSize="xs"
            >
              👁️ View Article Content
            </Button>
          </Flex>

          {/* Poster Preview */}
          <Box
            bg="#333"
            borderRadius="12px"
            p={4}
            minH="450px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {generatedPoster ? (
              // Check file type
              generatedPoster.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) || generatedPoster.startsWith('data:image') ? (
                // Image file - display directly
                <img src={generatedPoster} alt="Generated Poster" style={{ maxHeight: '420px', borderRadius: '8px' }} />
              ) : generatedPoster.match(/\.pdf$/i) ? (
                // PDF file - embed in iframe for preview
                <Flex direction="column" align="center" gap={3} w="100%">
                  <Box
                    as="iframe"
                    src={generatedPoster}
                    w="100%"
                    h="400px"
                    borderRadius="8px"
                    border="none"
                    bg="white"
                  />
                  <Flex gap={3}>
                    <Button
                      as="a"
                      href={generatedPoster}
                      target="_blank"
                      download
                      bg="#ba0006"
                      color="white"
                      size="sm"
                      borderRadius="8px"
                      _hover={{ bg: '#a00005' }}
                    >
                      📥 Download PDF
                    </Button>
                    <Button
                      as="a"
                      href={generatedPoster}
                      target="_blank"
                      variant="outline"
                      borderColor="white"
                      color="white"
                      size="sm"
                      borderRadius="8px"
                      _hover={{ bg: 'rgba(255,255,255,0.1)' }}
                    >
                      🔗 Open in New Tab
                    </Button>
                  </Flex>
                </Flex>
              ) : (
                // Other document types (DOCX, PPTX, etc.) - show download option
                <Flex
                  direction="column"
                  align="center"
                  justify="center"
                  bg="white"
                  w="280px"
                  h="400px"
                  borderRadius="8px"
                  p={6}
                  gap={4}
                >
                  <Box fontSize="4xl">📄</Box>
                  <Box as="span" color="#333" fontSize="md" fontWeight="600" textAlign="center">
                    Poster Generated!
                  </Box>
                  <Box as="span" color="#666" fontSize="xs" textAlign="center">
                    {generatedPoster.split('/').pop()}
                  </Box>
                  <Button
                    as="a"
                    href={generatedPoster}
                    target="_blank"
                    download
                    bg="#ba0006"
                    color="white"
                    size="sm"
                    borderRadius="8px"
                    _hover={{ bg: '#a00005' }}
                  >
                    📥 Download File
                  </Button>
                  <Button
                    as="a"
                    href={generatedPoster}
                    target="_blank"
                    variant="outline"
                    borderColor="#ba0006"
                    color="#ba0006"
                    size="sm"
                    borderRadius="8px"
                  >
                    🔗 Open in New Tab
                  </Button>
                </Flex>
              )
            ) : (
              <Box
                bg="white"
                w="280px"
                h="400px"
                borderRadius="8px"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Box as="span" color="#999" fontSize="sm">
                  Click "Generate Poster" to create
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* Right Column - Settings */}
        <Box w="220px">
          <Box as="span" fontSize="sm" fontWeight="600" color="#ba0006" mb={3} display="block">
            Settings
          </Box>
          
          <Flex direction="column" gap={4}>
            {/* Orientation */}
            <Box>
              <Box as="span" fontSize="xs" fontWeight="500" color="#666" mb={2} display="block">
                Orientation
              </Box>
              <Flex gap={2}>
                <Button
                  size="sm"
                  variant={orientation === 'portrait' ? 'solid' : 'outline'}
                  bg={orientation === 'portrait' ? '#f5f5f5' : 'white'}
                  onClick={() => setOrientation('portrait')}
                  fontSize="xs"
                >
                  Portrait
                </Button>
                <Button
                  size="sm"
                  variant={orientation === 'landscape' ? 'solid' : 'outline'}
                  bg={orientation === 'landscape' ? '#f5f5f5' : 'white'}
                  onClick={() => setOrientation('landscape')}
                  fontSize="xs"
                >
                  Landscape
                </Button>
              </Flex>
            </Box>

            {/* Color Palette */}
            <Box>
              <Box as="span" fontSize="xs" fontWeight="500" color="#666" mb={2} display="block">
                Color Palette
              </Box>
              <Flex gap={2}>
                {colorOptions.map((color) => (
                  <Box
                    key={color}
                    w="28px"
                    h="28px"
                    borderRadius="full"
                    bg={color}
                    cursor="pointer"
                    border={colorPalette === color ? '3px solid #333' : 'none'}
                    onClick={() => setColorPalette(color)}
                  />
                ))}
              </Flex>
            </Box>

            {/* Font Presets */}
            <Box>
              <Box as="span" fontSize="xs" fontWeight="500" color="#666" mb={2} display="block">
                Font Presets
              </Box>
              <select
                value={fontPreset}
                onChange={(e) => setFontPreset(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'white',
                  border: '1px solid #e0d8d3',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <option value="modern-sans">Modern Sans</option>
                <option value="classic-serif">Classic Serif</option>
                <option value="playful">Playful</option>
              </select>
            </Box>

            {/* Custom Key Points */}
            <Box>
              <Box as="label" fontSize="xs" fontWeight="600" color="#333" mb={2} display="block">
                Custom Key Points
              </Box>
              <textarea
                placeholder="Enter specific keywords or phrases the poster should focus on, separated by commas"
                value={customKeyPoints}
                onChange={(e) => setCustomKeyPoints(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'white',
                  border: '1px solid #e0d8d3',
                  borderRadius: '8px',
                  fontSize: '12px',
                  resize: 'vertical'
                }}
              />
            </Box>

            {/* Generate Button */}
            <Button
              bg="#ba0006"
              color="white"
              borderRadius="8px"
              py={4}
              fontSize="sm"
              fontWeight="600"
              onClick={handleGeneratePoster}
              isDisabled={generating}
              _hover={{ bg: '#a00005' }}
              _disabled={{ opacity: 0.6, cursor: 'not-allowed' }}
            >
              {generating ? 'Generating...' : '✨ Generate Poster'}
            </Button>

            {/* Version History */}
            <Box>
              <Box as="span" fontSize="xs" fontWeight="600" color="#333" mb={2} display="block">
                Version History
              </Box>
              <Flex direction="column" gap={1}>
                {versionHistory.map((version) => (
                  <Flex key={version.id} justify="space-between" align="center" fontSize="xs">
                    <Box as="span" color="#666" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" maxW="120px">{version.name}</Box>
                    <Box as="span" color="#ba0006" cursor="pointer">Reopen ↗</Box>
                  </Flex>
                ))}
              </Flex>
            </Box>

            {/* Action Buttons */}
            <Button
              variant="ghost"
              color="#ba0006"
              size="sm"
              onClick={handleImport}
            >
              📥 Import
            </Button>
            <Button
              variant="outline"
              borderColor="#ba0006"
              color="#ba0006"
              size="sm"
              onClick={handleExport}
            >
              ↗️ Export
            </Button>
            <Button
              bg="#ba0006"
              color="white"
              size="sm"
              onClick={() => handleSave(false)}
              _hover={{ bg: '#a00005' }}
            >
              💾 Save
            </Button>
          </Flex>
        </Box>
      </Flex>

      {/* Article Content Preview Modal */}
      {previewOpen && (
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
          zIndex={1000}
          onClick={() => setPreviewOpen(false)}
        >
          <Box
            bg="white"
            p={6}
            borderRadius="12px"
            maxW="600px"
            w="90%"
            maxH="80vh"
            overflowY="auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Flex justify="space-between" align="center" mb={4}>
              <Box as="span" fontSize="lg" fontWeight="700" color="#333">
                Article Content
              </Box>
              <Box
                as="button"
                onClick={() => setPreviewOpen(false)}
                fontSize="24px"
                color="#999"
                cursor="pointer"
                bg="none"
                border="none"
              >
                ×
              </Box>
            </Flex>
            <Box as="p" fontSize="sm" color="#5a5a5a" lineHeight="1.8" whiteSpace="pre-wrap">
              {article?.content || 'No content available'}
            </Box>
          </Box>
        </Box>
      )}

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
                _hover={{ bg: '#a00005' }}
              >
                Save
              </Button>
              <Button
                variant="outline"
                borderColor="#666"
                color="#666"
                px={6}
                py={2}
                borderRadius="8px"
                fontWeight="600"
                onClick={handleDiscardChanges}
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
                onClick={handleCancelDialog}
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

export default GeneratePDFPoster;
