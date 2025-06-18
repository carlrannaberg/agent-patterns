# Evaluation Dashboard Documentation

## Overview

The Evaluation Dashboard provides comprehensive visualization and management tools for monitoring agent pattern performance metrics, analyzing evaluation results, and managing evaluation schedules.

## Features

### 1. Dashboard Overview
- **Key Metrics**: Total evaluations, average score, success rate, and system health
- **Pattern Distribution**: Pie chart showing evaluation distribution across patterns
- **Performance Comparison**: Bar chart comparing pattern performance metrics
- **Top Metrics**: List of best-performing evaluation metrics
- **Recent Failures**: Quick view of recent evaluation failures

### 2. Real-Time Monitor
- **Live Evaluation Tracking**: Monitor evaluations as they run
- **Performance Metrics**: Real-time throughput, average score, and latency
- **Trend Visualization**: Live charts showing score trends and system metrics
- **Active Evaluations Table**: Track progress of ongoing evaluations
- **Recent Results**: Quick access to latest evaluation results

### 3. Historical Analysis
- **Time Series Charts**: Analyze metrics over time with customizable date ranges
- **Multiple Chart Types**: Line, area, and bar chart visualizations
- **Metric Selection**: Choose from various metrics (score, accuracy, efficiency, etc.)
- **Interval Grouping**: View data by hour, day, or week
- **Export Functionality**: Download data as CSV for further analysis
- **Statistical Summary**: Average, min/max, and trend indicators

### 4. Pattern Comparison
- **Multi-Pattern Analysis**: Compare performance across different patterns
- **Visualization Modes**:
  - Radar Chart: Multi-dimensional metric comparison
  - Bar Chart: Side-by-side metric comparison
  - Scatter Plot: Efficiency vs accuracy analysis
- **Detailed Metrics Table**: Comprehensive comparison of all metrics
- **Key Insights**: Automatic identification of best performers

### 5. Failure Analysis
- **Error Pattern Detection**: Identify common failure patterns
- **Failure Categorization**: Group failures by type and impact
- **Root Cause Analysis**: Detailed failure information with suggested fixes
- **Visualizations**:
  - Error type distribution pie chart
  - Pattern failure frequency bar chart
  - Impact severity breakdown
  - Failure hierarchy treemap
- **Optimization Recommendations**: Automated suggestions for improvements

### 6. Schedule Manager
- **Schedule Creation**: Set up automated evaluation runs
- **Frequency Options**: Once, hourly, daily, weekly, or monthly
- **Pattern Selection**: Choose specific patterns or run all
- **Enable/Disable**: Toggle schedules on/off
- **Run History**: View past schedule executions
- **Manual Execution**: Run schedules on-demand
- **Email Notifications**: Optional alerts for schedule completions

## Usage Guide

### Accessing the Dashboard
1. Navigate to `/evaluation-dashboard` in the application
2. The dashboard loads with the Overview tab by default

### Creating an Evaluation Schedule
1. Go to the Schedule Manager tab
2. Click "Create Schedule"
3. Fill in:
   - Schedule name
   - Pattern to evaluate
   - Frequency
   - Next run time
   - Notification email (optional)
4. Click "Create" to save the schedule

### Analyzing Historical Data
1. Go to the Historical Analysis tab
2. Select:
   - Pattern (or "All Patterns")
   - Metric to analyze
   - Date range
   - Time interval grouping
3. Choose chart type (line, area, or bar)
4. Export data using the "Export CSV" button

### Investigating Failures
1. Go to the Failure Analysis tab
2. Use filters to narrow down:
   - Error type
   - Search by error message
3. Click on a failure row to expand details
4. Review root cause and suggested fixes

### Comparing Pattern Performance
1. Go to the Pattern Comparison tab
2. Select patterns to compare using checkboxes
3. Choose visualization mode:
   - Radar chart for overall comparison
   - Bar chart for metric-by-metric view
   - Scatter plot for efficiency analysis
4. Review the detailed metrics table

## Data Export Options

### CSV Export
- Available in Historical Analysis for time series data
- Includes date, value, pattern, and metric columns

### PDF Report Generation
- Generate comprehensive evaluation reports
- Includes all dashboard visualizations
- Customizable time ranges

### Chart Image Export
- Save individual charts as PNG images
- High-resolution output for presentations

## Performance Considerations

### Data Loading
- Dashboard data refreshes every 30 seconds
- Manual refresh available via refresh button
- Lazy loading for large datasets

### Responsive Design
- Optimized for desktop and tablet viewing
- Mobile-responsive layouts
- Touch-friendly controls

## Troubleshooting

### Common Issues

1. **Dashboard not loading**
   - Check API connection
   - Verify evaluation service is running
   - Check browser console for errors

2. **Missing data**
   - Ensure evaluations have been run
   - Check date range selections
   - Verify pattern selections

3. **Export not working**
   - Check browser permissions
   - Ensure data is loaded
   - Try different export format

### API Endpoints Used

- `GET /evaluation/reporting/dashboard/summary`
- `GET /evaluation/reporting/results`
- `GET /evaluation/reporting/metrics/time-series`
- `GET /evaluation/reporting/failures/patterns`
- `GET /evaluation/reporting/quality/comparison`

## Best Practices

1. **Regular Monitoring**
   - Check dashboard daily for system health
   - Review failure patterns weekly
   - Analyze trends monthly

2. **Schedule Management**
   - Set up automated evaluations for consistent monitoring
   - Use appropriate frequencies based on pattern usage
   - Enable notifications for critical patterns

3. **Performance Optimization**
   - Focus on patterns with low scores
   - Investigate recurring failures
   - Implement suggested optimizations

4. **Reporting**
   - Generate weekly performance reports
   - Share insights with development team
   - Track improvements over time