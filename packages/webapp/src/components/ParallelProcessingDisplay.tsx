import { Box, Typography, Card, CardContent, Chip, Divider, List, ListItem, ListItemText, Alert } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import BuildIcon from '@mui/icons-material/Build';

interface SecurityReview {
  type: 'security';
  vulnerabilities?: string[];
}

interface PerformanceReview {
  type: 'performance';
  impact?: string;
  issues?: string[];
  optimizations?: string[];
}

interface MaintainabilityReview {
  type: 'maintainability';
  concerns?: string[];
  qualityScore?: number;
  recommendations?: string[];
}

type Review = SecurityReview | PerformanceReview | MaintainabilityReview;

interface ParallelProcessingResult {
  reviews?: Review[];
  summary?: string;
}

interface ParallelProcessingDisplayProps {
  result: ParallelProcessingResult;
}

const getReviewIcon = (type: string) => {
  switch (type) {
    case 'security':
      return <SecurityIcon />;
    case 'performance':
      return <SpeedIcon />;
    case 'maintainability':
      return <BuildIcon />;
    default:
      return null;
  }
};

const getImpactColor = (impact: string) => {
  switch (impact?.toLowerCase()) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};

const getQualityScoreColor = (score: number) => {
  if (score >= 8) return 'success';
  if (score >= 6) return 'warning';
  if (score >= 4) return 'error';
  return 'error';
};

export default function ParallelProcessingDisplay({ result }: ParallelProcessingDisplayProps) {
  const { reviews, summary } = result;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Reviews */}
      {reviews && reviews.map((review, index) => (
        <Card key={index}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              {getReviewIcon(review.type)}
              <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                {review.type} Review
              </Typography>
              {review.type === 'performance' && 'impact' in review && review.impact && (
                <Chip 
                  label={`Impact: ${review.impact}`}
                  color={getImpactColor(review.impact)}
                  size="small"
                />
              )}
              {review.type === 'maintainability' && 'qualityScore' in review && review.qualityScore && (
                <Chip 
                  label={`Quality: ${review.qualityScore}/10`}
                  color={getQualityScoreColor(review.qualityScore)}
                  size="small"
                />
              )}
            </Box>

            {/* Security Review */}
            {review.type === 'security' && 'vulnerabilities' in review && review.vulnerabilities && (
              <>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Vulnerabilities Found:
                </Typography>
                <List dense>
                  {review.vulnerabilities.map((vuln, idx) => (
                    <ListItem key={idx} disablePadding>
                      <Alert severity="error" sx={{ width: '100%', mb: 1 }}>
                        <ListItemText primary={vuln} />
                      </Alert>
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {/* Performance Review */}
            {review.type === 'performance' && 'issues' in review && (
              <>
                {review.issues && (
                  <>
                    <Typography variant="subtitle2" color="warning.main" gutterBottom sx={{ mt: 2 }}>
                      Performance Issues:
                    </Typography>
                    <List dense>
                      {review.issues.map((issue, idx) => (
                        <ListItem key={idx} disablePadding sx={{ mb: 1 }}>
                          <ListItemText 
                            primary={issue}
                            sx={{ 
                              '& .MuiListItemText-primary': { 
                                fontSize: '0.875rem',
                                lineHeight: 1.6 
                              }
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
                
                {review.optimizations && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="success.main" gutterBottom>
                      Recommended Optimizations:
                    </Typography>
                    <List dense>
                      {review.optimizations.map((opt, idx) => (
                        <ListItem key={idx} disablePadding sx={{ mb: 1 }}>
                          <ListItemText 
                            primary={opt}
                            sx={{ 
                              '& .MuiListItemText-primary': { 
                                fontSize: '0.875rem',
                                lineHeight: 1.6 
                              }
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </>
            )}

            {/* Maintainability Review */}
            {review.type === 'maintainability' && 'concerns' in review && (
              <>
                {review.concerns && (
                  <>
                    <Typography variant="subtitle2" color="warning.main" gutterBottom>
                      Maintainability Concerns:
                    </Typography>
                    <List dense>
                      {review.concerns.map((concern, idx) => (
                        <ListItem key={idx} disablePadding sx={{ mb: 1 }}>
                          <ListItemText 
                            primary={concern}
                            sx={{ 
                              '& .MuiListItemText-primary': { 
                                fontSize: '0.875rem',
                                lineHeight: 1.6 
                              }
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}

                {review.recommendations && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="info.main" gutterBottom>
                      Recommendations:
                    </Typography>
                    <List dense>
                      {review.recommendations.map((rec, idx) => (
                        <ListItem key={idx} disablePadding sx={{ mb: 1 }}>
                          <ListItemText 
                            primary={rec}
                            sx={{ 
                              '& .MuiListItemText-primary': { 
                                fontSize: '0.875rem',
                                lineHeight: 1.6 
                              }
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Summary */}
      {summary && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Code Review Summary
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography 
              variant="body1" 
              sx={{ 
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                '& strong': {
                  fontWeight: 600
                }
              }}
            >
              {summary}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
