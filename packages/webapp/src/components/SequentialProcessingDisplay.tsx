import { Box, Typography, Card, CardContent, Chip, Divider } from '@mui/material';
import ReactMarkdown from 'react-markdown';

interface QualityMetrics {
  clarity?: number;
  emotionalAppeal?: number;
  hasCallToAction?: boolean;
}

interface SequentialProcessingResult {
  finalCopy?: string;
  originalCopy?: string;
  qualityMetrics?: QualityMetrics;
  wasImproved?: boolean;
}

interface SequentialProcessingDisplayProps {
  result: SequentialProcessingResult;
}

export default function SequentialProcessingDisplay({ result }: SequentialProcessingDisplayProps) {
  const { finalCopy, originalCopy, qualityMetrics, wasImproved } = result;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Final Copy */}
      {finalCopy && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Final Marketing Copy
              {wasImproved && <Chip label="Enhanced" color="success" size="small" />}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ 
              '& h1, & h2, & h3, & h4, & h5, & h6': { 
                marginTop: 2, 
                marginBottom: 1,
                color: 'primary.main'
              },
              '& p': { 
                marginBottom: 1.5, 
                lineHeight: 1.6 
              },
              '& ul, & ol': { 
                paddingLeft: 2,
                marginBottom: 1.5
              },
              '& li': {
                marginBottom: 0.5
              },
              '& strong': {
                fontWeight: 600
              },
              '& em': {
                fontStyle: 'italic',
                color: 'text.secondary'
              }
            }}>
              <ReactMarkdown>{finalCopy}</ReactMarkdown>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Original Copy (only show if different from final) */}
      {originalCopy && wasImproved && originalCopy !== finalCopy && (
        <Card sx={{ opacity: 0.8 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Original Copy
              <Chip label="Before Enhancement" color="default" size="small" variant="outlined" />
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ 
              '& h1, & h2, & h3, & h4, & h5, & h6': { 
                marginTop: 2, 
                marginBottom: 1,
                color: 'text.secondary'
              },
              '& p': { 
                marginBottom: 1.5, 
                lineHeight: 1.6,
                color: 'text.secondary'
              },
              '& ul, & ol': { 
                paddingLeft: 2,
                marginBottom: 1.5
              },
              '& li': {
                marginBottom: 0.5,
                color: 'text.secondary'
              }
            }}>
              <ReactMarkdown>{originalCopy}</ReactMarkdown>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Quality Metrics */}
      {qualityMetrics && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quality Assessment
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {qualityMetrics.clarity && (
                <Chip 
                  label={`Clarity: ${qualityMetrics.clarity}/10`}
                  color={qualityMetrics.clarity >= 8 ? 'success' : qualityMetrics.clarity >= 6 ? 'warning' : 'error'}
                  variant="outlined"
                />
              )}
              {qualityMetrics.emotionalAppeal && (
                <Chip 
                  label={`Emotional Appeal: ${qualityMetrics.emotionalAppeal}/10`}
                  color={qualityMetrics.emotionalAppeal >= 8 ? 'success' : qualityMetrics.emotionalAppeal >= 6 ? 'warning' : 'error'}
                  variant="outlined"
                />
              )}
              {qualityMetrics.hasCallToAction !== undefined && (
                <Chip 
                  label={`Call to Action: ${qualityMetrics.hasCallToAction ? 'Yes' : 'No'}`}
                  color={qualityMetrics.hasCallToAction ? 'success' : 'error'}
                  variant="outlined"
                />
              )}
              {wasImproved !== undefined && (
                <Chip 
                  label={wasImproved ? 'Improved' : 'No Changes Needed'}
                  color={wasImproved ? 'info' : 'success'}
                />
              )}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
