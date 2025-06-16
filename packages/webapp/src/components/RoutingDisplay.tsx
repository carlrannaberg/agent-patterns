import { Box, Typography, Card, CardContent, Chip, Divider, type ChipProps } from '@mui/material';

interface Classification {
  complexity?: string;
  reasoning?: string;
  type?: string;
}

interface RoutingResult {
  classification?: Classification;
  modelUsed?: string;
  response?: string;
}

interface RoutingDisplayProps {
  result: RoutingResult;
}

type ChipColor = NonNullable<ChipProps['color']>;

const getComplexityColor = (complexity: string): ChipColor => {
  switch (complexity?.toLowerCase()) {
    case 'simple':
      return 'success';
    case 'medium':
    case 'moderate':
      return 'warning';
    case 'complex':
    case 'high':
      return 'error';
    default:
      return 'default';
  }
};

const getTypeColor = (type: string): ChipColor => {
  const colors: { [key: string]: ChipColor } = {
    'refund': 'info',
    'support': 'primary',
    'billing': 'warning',
    'technical': 'secondary',
    'complaint': 'error',
    'general': 'default'
  };
  return colors[type?.toLowerCase()] || 'default';
};

export default function RoutingDisplay({ result }: RoutingDisplayProps) {
  const { classification, modelUsed, response } = result;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Classification */}
      {classification && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Query Classification
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {classification.type && (
                <Chip
                  label={`Type: ${classification.type}`}
                  color={getTypeColor(classification.type)}
                  variant="outlined"
                />
              )}
              {classification.complexity && (
                <Chip
                  label={`Complexity: ${classification.complexity}`}
                  color={getComplexityColor(classification.complexity)}
                  variant="outlined"
                />
              )}
            </Box>
            {classification.reasoning && (
              <>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Reasoning:
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                  {classification.reasoning}
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Response */}
      {response && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Specialized Response
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
              {response}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Model Info */}
      {modelUsed && (
        <Card sx={{ backgroundColor: 'grey.50' }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Processed by: {modelUsed.replace('models/', '')}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
