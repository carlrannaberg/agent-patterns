import { Box, Typography, Card, CardContent, Chip, Divider, Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemText } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TranslateIcon from '@mui/icons-material/Translate';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface Evaluation {
  culturallyAccurate?: boolean;
  preservesNuance?: boolean;
  preservesTone?: boolean;
  qualityScore?: number;
  improvementSuggestions?: string[];
  specificIssues?: string[];
}

interface IterationResult {
  iteration?: number;
  translation?: string;
  evaluation?: Evaluation;
}

interface EvaluatorOptimizerResult {
  originalText?: string;
  targetLanguage?: string;
  finalTranslation?: string;
  iterationResults?: IterationResult[];
  iterationsRequired?: number;
}

interface EvaluatorOptimizerDisplayProps {
  result: EvaluatorOptimizerResult;
}

const getQualityScoreColor = (score: number | undefined) => {
  if (!score) return 'default';
  if (score >= 9.5) return 'success';
  if (score >= 8.5) return 'info';
  if (score >= 7.0) return 'warning';
  return 'error';
};

const getQualityScoreText = (score: number | undefined) => {
  if (!score) return 'Not scored';
  if (score >= 9.5) return 'Excellent';
  if (score >= 8.5) return 'Very Good';
  if (score >= 7.0) return 'Good';
  return 'Needs Improvement';
};

export default function EvaluatorOptimizerDisplay({ result }: EvaluatorOptimizerDisplayProps) {
  const { originalText, targetLanguage, finalTranslation, iterationResults, iterationsRequired } = result;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Original Text */}
      {originalText && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TranslateIcon />
              Original Text {targetLanguage && `(to ${targetLanguage})`}
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                p: 2, 
                backgroundColor: 'grey.50', 
                borderRadius: 1,
                fontStyle: 'italic',
                lineHeight: 1.6
              }}
            >
              {originalText}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Iteration Process */}
      {iterationResults && iterationResults.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon />
              Translation Process ({iterationsRequired !== undefined ? `${iterationsRequired} iterations` : `${iterationResults.length} steps`})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {iterationResults.map((iteration, index) => (
                <Accordion key={index}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="subtitle1">
                        {iteration.iteration === 0 ? 'Initial Translation' : `Iteration ${iteration.iteration || index}`}
                      </Typography>
                      {iteration.evaluation?.qualityScore && (
                        <Chip 
                          label={`${iteration.evaluation.qualityScore}/10 - ${getQualityScoreText(iteration.evaluation.qualityScore)}`}
                          color={getQualityScoreColor(iteration.evaluation.qualityScore)}
                          size="small"
                        />
                      )}
                      <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                        {iteration.evaluation?.culturallyAccurate && (
                          <Chip label="Culturally Accurate" color="success" size="small" variant="outlined" />
                        )}
                        {iteration.evaluation?.preservesNuance && (
                          <Chip label="Preserves Nuance" color="info" size="small" variant="outlined" />
                        )}
                        {iteration.evaluation?.preservesTone && (
                          <Chip label="Preserves Tone" color="primary" size="small" variant="outlined" />
                        )}
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* Translation */}
                      {iteration.translation && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Translation:
                          </Typography>
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              p: 2, 
                              backgroundColor: 'blue.50', 
                              borderRadius: 1,
                              lineHeight: 1.6,
                              border: '1px solid',
                              borderColor: 'blue.200'
                            }}
                          >
                            {iteration.translation}
                          </Typography>
                        </Box>
                      )}

                      <Divider />

                      {/* Evaluation Details */}
                      {iteration.evaluation && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Quality Assessment:
                          </Typography>
                          
                          {/* Quality Metrics */}
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                            {iteration.evaluation.qualityScore && (
                              <Chip 
                                label={`Quality Score: ${iteration.evaluation.qualityScore}/10`}
                                color={getQualityScoreColor(iteration.evaluation.qualityScore)}
                                variant="filled"
                              />
                            )}
                          </Box>

                          {/* Specific Issues */}
                          {iteration.evaluation.specificIssues && iteration.evaluation.specificIssues.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                <strong>Analysis:</strong>
                              </Typography>
                              <List dense>
                                {iteration.evaluation.specificIssues.map((issue, idx) => (
                                  <ListItem key={idx} disablePadding>
                                    <ListItemText 
                                      primary={issue}
                                      sx={{ 
                                        '& .MuiListItemText-primary': { 
                                          fontSize: '0.875rem',
                                          lineHeight: 1.5
                                        }
                                      }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}

                          {/* Improvement Suggestions */}
                          {iteration.evaluation.improvementSuggestions && iteration.evaluation.improvementSuggestions.length > 0 && (
                            <Box>
                              <Typography variant="body2" color="warning.main" gutterBottom>
                                <strong>Improvement Suggestions:</strong>
                              </Typography>
                              <List dense>
                                {iteration.evaluation.improvementSuggestions.map((suggestion, idx) => (
                                  <ListItem key={idx} disablePadding>
                                    <ListItemText 
                                      primary={suggestion}
                                      sx={{ 
                                        '& .MuiListItemText-primary': { 
                                          fontSize: '0.875rem',
                                          lineHeight: 1.5,
                                          color: 'warning.main'
                                        }
                                      }}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Final Translation */}
      {finalTranslation && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" />
              Final Optimized Translation
              {iterationsRequired !== undefined && iterationsRequired === 0 && (
                <Chip label="No optimization needed" color="success" size="small" />
              )}
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                p: 3, 
                backgroundColor: 'success.50', 
                borderRadius: 1,
                lineHeight: 1.7,
                border: '2px solid',
                borderColor: 'success.200',
                fontSize: '1.05rem'
              }}
            >
              {finalTranslation}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!originalText && !finalTranslation && (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              Translation process starting...
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
