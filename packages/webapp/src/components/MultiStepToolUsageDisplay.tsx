import { Box, Typography, Card, CardContent, Chip, List, ListItem, Alert } from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FunctionsIcon from '@mui/icons-material/Functions';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';

interface Calculation {
  expression?: string;
  result?: string;
  step?: number;
}

interface Step {
  calculation: string;
  reasoning: string;
}

interface MultiStepToolUsageResult {
  problem?: string;
  calculations?: Calculation[];
  steps?: Step[]; // Changed from string[] to Step[]
  workingSteps?: string;
  finalAnswer?: string;
}

interface MultiStepToolUsageDisplayProps {
  result: MultiStepToolUsageResult;
}

export default function MultiStepToolUsageDisplay({ result }: MultiStepToolUsageDisplayProps) {
  const { problem, calculations, steps, workingSteps, finalAnswer } = result;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Problem Statement */}
      {problem && (
        <Card>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <FunctionsIcon />
              Problem
            </Typography>
            <Typography
              variant="body1"
              sx={{
                p: 2,
                backgroundColor: "grey.50",
                borderRadius: 1,
                lineHeight: 1.6,
                border: "1px solid",
                borderColor: "grey.200",
              }}
            >
              {String(problem)}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Working Steps */}
      {workingSteps && (
        <Card>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <PlaylistAddCheckIcon />
              Solution Approach
            </Typography>
            <Typography
              variant="body1"
              sx={{
                p: 2,
                backgroundColor: "info.50",
                borderRadius: 1,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                border: "1px solid",
                borderColor: "info.200",
              }}
            >
              {String(workingSteps)}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Step-by-step breakdown */}
      {steps && Array.isArray(steps) && steps.length > 0 && (
        <Card>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <PlaylistAddCheckIcon />
              Step-by-Step Solution
            </Typography>
            <List>
              {steps
                .filter((step) => step && typeof step === "object")
                .map((step, index) => (
                  <ListItem key={index} disablePadding sx={{ mb: 2 }}>
                    <Box sx={{ width: "100%" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                        <Chip label={`Step ${index + 1}`} color="primary" size="small" />
                      </Box>
                      <Box
                        sx={{
                          p: 2,
                          backgroundColor: "grey.50",
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: "grey.200",
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <strong>Calculation:</strong>
                        </Typography>
                        <Typography
                          variant="body1"
                          sx={{
                            fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                            mb: 1,
                          }}
                        >
                          {String(step.calculation || "N/A")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          <strong>Reasoning:</strong>
                        </Typography>
                        <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                          {String(step.reasoning || "N/A")}
                        </Typography>
                      </Box>
                    </Box>
                  </ListItem>
                ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Calculations */}
      {calculations && Array.isArray(calculations) && calculations.length > 0 && (
        <Card>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <CalculateIcon />
              Calculations ({calculations.length})
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {calculations.map((calc, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 2,
                    backgroundColor: "warning.50",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "warning.200",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Chip label={`Step ${calc.step || index + 1}`} color="warning" size="small" />
                  </Box>

                  {calc.expression && (
                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                        fontSize: "1.1rem",
                        mb: 1,
                      }}
                    >
                      <strong>Expression:</strong> {String(calc.expression)}
                    </Typography>
                  )}

                  {calc.result && (
                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                        fontSize: "1.1rem",
                        color: "success.main",
                        fontWeight: "bold",
                      }}
                    >
                      <strong>Result:</strong> {String(calc.result)}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Final Answer */}
      {finalAnswer && finalAnswer !== "No answer provided" && (
        <Card>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <CheckCircleIcon color="success" />
              Final Answer
            </Typography>
            <Alert
              severity="success"
              sx={{
                fontSize: "1.1rem",
                fontWeight: "bold",
                "& .MuiAlert-message": {
                  fontSize: "inherit",
                  fontWeight: "inherit",
                },
              }}
            >
              {String(finalAnswer)}
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Processing State - only show when no meaningful data yet */}
      {!problem && !calculations?.length && !finalAnswer && (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              Processing your math problem...
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* No Final Answer State - only show if we have calculations but no final answer */}
      {finalAnswer === "No answer provided" &&
        calculations &&
        calculations.length > 0 &&
        !workingSteps &&
        !steps?.length && (
          <Card>
            <CardContent>
              <Alert severity="warning">
                Calculations completed but no final answer provided. The problem may need additional
                steps.
              </Alert>
            </CardContent>
          </Card>
        )}
    </Box>
  );
}
