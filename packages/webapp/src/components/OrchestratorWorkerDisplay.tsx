import { Box, Typography, Card, CardContent, Chip, Divider, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CreateIcon from '@mui/icons-material/CreateNewFolder';
import EditIcon from '@mui/icons-material/Edit';
import CodeIcon from '@mui/icons-material/Code';

interface FileInfo {
  changeType: string;
  filePath: string;
  purpose: string;
}

interface Implementation {
  code: string;
  explanation: string;
}

interface Change {
  file: FileInfo;
  implementation?: Implementation;
}

interface Plan {
  estimatedComplexity: string;
  files: FileInfo[];
}

interface OrchestratorWorkerResult {
  changes?: Change[];
  plan?: Plan;
}

interface OrchestratorWorkerDisplayProps {
  result: OrchestratorWorkerResult;
}

const getChangeTypeIcon = (changeType: string) => {
  switch (changeType?.toLowerCase()) {
    case 'create':
      return <CreateIcon />;
    case 'modify':
    case 'update':
      return <EditIcon />;
    default:
      return <CodeIcon />;
  }
};

const getChangeTypeColor = (changeType: string) => {
  switch (changeType?.toLowerCase()) {
    case 'create':
      return 'success';
    case 'modify':
    case 'update':
      return 'warning';
    default:
      return 'default';
  }
};

const getComplexityColor = (complexity: string) => {
  switch (complexity?.toLowerCase()) {
    case 'low':
    case 'simple':
      return 'success';
    case 'medium':
    case 'moderate':
      return 'warning';
    case 'high':
    case 'complex':
      return 'error';
    default:
      return 'default';
  }
};

export default function OrchestratorWorkerDisplay({ result }: OrchestratorWorkerDisplayProps) {
  const { changes, plan } = result;

  // Group changes by type
  const createChanges = changes?.filter(change => change.file.changeType.toLowerCase() === 'create') || [];
  const modifyChanges = changes?.filter(change => change.file.changeType.toLowerCase() !== 'create') || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Plan Overview */}
      {plan && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Implementation Plan
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip 
                label={`Complexity: ${plan.estimatedComplexity}`}
                color={getComplexityColor(plan.estimatedComplexity)}
                variant="outlined"
              />
              <Chip 
                label={`${plan.files.length} files affected`}
                color="info"
                variant="outlined"
              />
              <Chip 
                label={`${createChanges.length} new files`}
                color="success"
                variant="outlined"
              />
              <Chip 
                label={`${modifyChanges.length} modifications`}
                color="warning"
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* New Files */}
      {createChanges.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreateIcon color="success" />
              New Files ({createChanges.length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {createChanges.map((change, index) => (
                <Accordion key={index}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    {getChangeTypeIcon(change.file.changeType)}
                    <Chip 
                    label={change.file.changeType}
                    color={getChangeTypeColor(change.file.changeType)}
                      size="small"
                    />
                    <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', flexGrow: 1 }}>
                      {change.file.filePath}
                      </Typography>
                     </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Purpose:</strong> {change.file.purpose}
                      </Typography>
                      <Divider />
                      {change.implementation && (
                        <>
                          <Typography variant="subtitle2" gutterBottom>
                            Implementation:
                          </Typography>
                          <Box
                            component="pre"
                            sx={{
                              backgroundColor: 'grey.50',
                              p: 2,
                              borderRadius: 1,
                              overflow: 'auto',
                              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                              fontSize: '12px',
                              maxHeight: '400px',
                              border: '1px solid',
                              borderColor: 'grey.200'
                            }}
                          >
                          {change.implementation!.code}
                          </Box>
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                          <strong>Explanation:</strong> {change.implementation!.explanation}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Modified Files */}
      {modifyChanges.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon color="warning" />
              Modified Files ({modifyChanges.length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {modifyChanges.map((change, index) => (
                <Accordion key={index}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    {getChangeTypeIcon(change.file.changeType)}
                    <Chip 
                    label={change.file.changeType}
                    color={getChangeTypeColor(change.file.changeType)}
                      size="small"
                    />
                    <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', flexGrow: 1 }}>
                      {change.file.filePath}
                      </Typography>
                     </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Purpose:</strong> {change.file.purpose}
                      </Typography>
                      <Divider />
                      {change.implementation && (
                        <>
                          <Typography variant="subtitle2" gutterBottom>
                            Changes:
                          </Typography>
                          <Box
                            component="pre"
                            sx={{
                              backgroundColor: 'grey.50',
                              p: 2,
                              borderRadius: 1,
                              overflow: 'auto',
                              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                              fontSize: '12px',
                              maxHeight: '400px',
                              border: '1px solid',
                              borderColor: 'grey.200'
                            }}
                          >
                          {change.implementation!.code}
                          </Box>
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                          <strong>Explanation:</strong> {change.implementation!.explanation}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {(!changes || changes.length === 0) && (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              No implementation changes generated.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
