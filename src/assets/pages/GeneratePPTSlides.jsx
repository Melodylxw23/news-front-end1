import {
  Box,
  Button,
  Flex,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getArticle } from '../../api/articles';
import { generatePPT } from '../../api/contentCreation';

const GeneratePPTSlides = () => {
  const navigate = useNavigate();
  const { articleId } = useParams();
  
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedSlides, setGeneratedSlides] = useState([]);
  const [generatedPptPath, setGeneratedPptPath] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Settings
  const [selectedTemplate, setSelectedTemplate] = useState(1);
  const [layoutPreset, setLayoutPreset] = useState('standard');
  const [colorPalette, setColorPalette] = useState('#1a7f5a');
  const [fontPreset, setFontPreset] = useState('modern-sans');
  const [customKeyPoints, setCustomKeyPoints] = useState('');
  const [slideCount, setSlideCount] = useState(5);
  const [viewMode, setViewMode] = useState('grid');

  const templates = [
    { id: 1, name: 'Corporate', preview: '/templates/ppt1.png' },
    { id: 2, name: 'Minimal', preview: '/templates/ppt2.png' },
    { id: 3, name: 'Creative', preview: '/templates/ppt3.png' },
    { id: 4, name: 'Professional', preview: '/templates/ppt4.png' },
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
      } catch (e) {
        alert('Failed to load article: ' + (e.message || e));
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [articleId]);

  const handleGenerateSlides = async () => {
    setGenerating(true);
    try {
      // Build template name and custom prompt
      const templateName = templates.find(t => t.id === selectedTemplate)?.name || 'Corporate';
      const customPrompt = customKeyPoints ? `Focus on: ${customKeyPoints}` : null;
      
      const res = await generatePPT(parseInt(articleId), slideCount, templateName, customPrompt);
      
      // Get the PPT path from response
      const pptPath = res?.pptPath || res?.PptPath || '';
      
      // Create slide placeholders based on slideCount
      const slides = Array.from({ length: slideCount }, (_, i) => ({
        id: i + 1,
        title: `Slide ${i + 1}`,
        preview: null
      }));
      setGeneratedSlides(slides);
      setGeneratedPptPath(pptPath);
    } catch (e) {
      alert('Failed to generate slides: ' + (e.message || e));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    // TODO: Save PPT to article in backend
    alert('PPT slides saved!');
    navigate('/consultant/content-creation');
  };

  const handleExport = () => {
    // TODO: Export/download the PPTX
    alert('Exporting PPTX...');
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
        onClick={() => navigate('/consultant/content-creation')}
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
          bg="#887b76"
          color="white"
          borderRadius="8px"
          flex="1"
          py={3}
          fontSize="sm"
          fontWeight="500"
          _hover={{ bg: '#746862' }}
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
                <Box bg="#f5f5f5" h="50px" borderRadius="4px" mb={2} />
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

          {/* Number of Slides */}
          <Box mt={4}>
            <Flex justify="space-between" align="center" mb={2}>
              <Box as="span" fontSize="xs" fontWeight="500" color="#666">
                Number of Slides
              </Box>
              <Box as="span" fontSize="xs" fontWeight="600" color="#ba0006">
                {slideCount}
              </Box>
            </Flex>
            <Box>
              <input
                type="range"
                min="3"
                max="15"
                step="1"
                value={slideCount}
                onChange={(e) => setSlideCount(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  appearance: 'none',
                  background: `linear-gradient(to right, #ba0006 0%, #ba0006 ${(slideCount - 3) / 12 * 100}%, #e0d8d3 ${(slideCount - 3) / 12 * 100}%, #e0d8d3 100%)`,
                  cursor: 'pointer'
                }}
              />
            </Box>
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
              variant={viewMode === 'filmstrip' ? 'solid' : 'outline'}
              bg={viewMode === 'filmstrip' ? '#f5f5f5' : 'white'}
              onClick={() => setViewMode('filmstrip')}
              fontSize="xs"
            >
              ☰ Filmstrip
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'single' ? 'solid' : 'outline'}
              bg={viewMode === 'single' ? '#f5f5f5' : 'white'}
              onClick={() => setViewMode('single')}
              fontSize="xs"
            >
              □ Single
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

          {/* Slides Preview */}
          <Box
            bg="#333"
            borderRadius="12px"
            p={4}
            minH="450px"
          >
            {generatedSlides.length > 0 ? (
              viewMode === 'grid' ? (
                <Flex flexWrap="wrap" gap={4}>
                  {generatedSlides.map((slide, index) => (
                    <Box
                      key={slide.id}
                      bg="white"
                      w="200px"
                      h="120px"
                      borderRadius="8px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      cursor="pointer"
                      border={currentSlide === index ? '2px solid #ba0006' : 'none'}
                      onClick={() => setCurrentSlide(index)}
                    >
                      <Box as="span" fontSize="sm" color="#666">Slide {index + 1}</Box>
                    </Box>
                  ))}
                </Flex>
              ) : (
                <Flex direction="column" align="center">
                  <Box
                    bg="white"
                    w="400px"
                    h="250px"
                    borderRadius="8px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    mb={4}
                  >
                    <Box as="span" fontSize="lg" color="#666">Slide {currentSlide + 1}</Box>
                  </Box>
                  <Flex gap={4} align="center">
                    <Button
                      size="sm"
                      onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                      disabled={currentSlide === 0}
                    >
                      ← Previous
                    </Button>
                    <Box as="span" color="white" fontSize="sm">
                      {currentSlide + 1} / {generatedSlides.length}
                    </Box>
                    <Button
                      size="sm"
                      onClick={() => setCurrentSlide(Math.min(generatedSlides.length - 1, currentSlide + 1))}
                      disabled={currentSlide === generatedSlides.length - 1}
                    >
                      Next →
                    </Button>
                  </Flex>
                </Flex>
              )
            ) : (
              <Flex align="center" justify="center" h="400px">
                <Box
                  bg="white"
                  w="280px"
                  h="160px"
                  borderRadius="8px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Box as="span" color="#999" fontSize="sm">
                    Click "Generate Slides" to create
                  </Box>
                </Box>
              </Flex>
            )}
          </Box>
        </Box>

        {/* Right Column - Settings */}
        <Box w="220px">
          <Box as="span" fontSize="sm" fontWeight="600" color="#ba0006" mb={3} display="block">
            Settings
          </Box>
          
          <Flex direction="column" gap={4}>
            {/* Layout Preset */}
            <Box>
              <Box as="span" fontSize="xs" fontWeight="500" color="#666" mb={2} display="block">
                Layout Preset
              </Box>
              <select
                value={layoutPreset}
                onChange={(e) => setLayoutPreset(e.target.value)}
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
                <option value="standard">Standard</option>
                <option value="wide">Wide</option>
                <option value="compact">Compact</option>
              </select>
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
                placeholder="Enter specific keywords or phrases the slides should focus on, separated by commas"
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
              onClick={handleGenerateSlides}
              disabled={generating}
              _hover={{ bg: '#a00005' }}
            >
              {generating ? 'Generating...' : '✨ Generate Slides'}
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
              onClick={handleSave}
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
    </Box>
  );
};

export default GeneratePPTSlides;
