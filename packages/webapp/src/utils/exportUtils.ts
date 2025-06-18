import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma or newline
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });

  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
};

export const exportChartAsImage = async (chartElement: HTMLElement, filename: string) => {
  const canvas = await html2canvas(chartElement);
  const link = document.createElement('a');

  link.download = `${filename}.png`;
  link.href = canvas.toDataURL();
  link.click();
};

interface DashboardDataForReport {
  totalEvaluations: number;
  averageScore: number;
  successRate: number;
  systemHealth: {
    status: string;
    issues: string[];
  };
  patternPerformance: Array<{
    pattern: string;
    averageScore: number;
  }>;
  topMetrics: Array<{
    name: string;
    averageScore: number;
  }>;
}

export const generateReport = (
  dashboardData: DashboardDataForReport,
  patternMetrics: Record<string, unknown>[],
  timeRange: { start: Date; end: Date }
) => {
  const reportData = {
    generatedAt: new Date().toISOString(),
    timeRange: {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString()
    },
    summary: {
      totalEvaluations: dashboardData.totalEvaluations,
      averageScore: dashboardData.averageScore,
      successRate: dashboardData.successRate,
      systemHealth: dashboardData.systemHealth
    },
    patternPerformance: dashboardData.patternPerformance,
    topMetrics: dashboardData.topMetrics,
    patternDetails: patternMetrics,
    recommendations: generateRecommendations(dashboardData)
  };

  return reportData;
};

const generateRecommendations = (dashboardData: DashboardDataForReport) => {
  const recommendations = [];

  // Check for low performing patterns
  dashboardData.patternPerformance.forEach((pattern) => {
    if (pattern.averageScore < 0.7) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        pattern: pattern.pattern,
        message: `${pattern.pattern} is performing below threshold (${(pattern.averageScore * 100).toFixed(1)}%)`,
        suggestion: 'Review test cases and optimize pattern implementation'
      });
    }
  });

  // Check for high failure rates
  if (dashboardData.successRate < 0.8) {
    recommendations.push({
      type: 'reliability',
      severity: 'high',
      message: `Overall success rate is low (${(dashboardData.successRate * 100).toFixed(1)}%)`,
      suggestion: 'Investigate common failure patterns and implement error handling improvements'
    });
  }

  // Check for system health issues
  if (dashboardData.systemHealth.status !== 'healthy') {
    recommendations.push({
      type: 'system',
      severity: dashboardData.systemHealth.status === 'critical' ? 'critical' : 'medium',
      message: `System health is ${dashboardData.systemHealth.status}`,
      suggestion: 'Address system health issues: ' + dashboardData.systemHealth.issues.join(', ')
    });
  }

  return recommendations;
};