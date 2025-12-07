import fs from 'fs';
import path from 'path';

export class FinancialDataProcessor {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  // Extract financial data for a specific company and time period
  async getFinancialData(company, fiscalYear, quarter) {
    try {
      const filePath = path.join(this.baseDir, company, `FY_${fiscalYear}`, `Q${quarter}`, `${company}_FY_${fiscalYear}_Q${quarter}.json`);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return this.extractKeyMetrics(data);
    } catch (error) {
      console.error(`Error reading financial data for ${company} FY${fiscalYear} Q${quarter}:`, error);
      return null;
    }
  }

  // Extract key metrics from financial data
  extractKeyMetrics(data) {
    const financial = data.financial_report;
    if (!financial) return null;

    // Handle different data structures for different companies
    let revenue = 0;
    let netIncome = 0;
    let grossMargin = 0;
    let operatingMargin = 0;

    // Try different revenue field names
    if (financial.income_statement?.net_sales?.total?.value) {
      revenue = financial.income_statement.net_sales.total.value;
    } else if (financial.income_statement?.revenue?.total?.value) {
      revenue = financial.income_statement.revenue.total.value;
    }

    // Try different net income field names
    if (financial.income_statement?.net_income?.value) {
      netIncome = financial.income_statement.net_income.value;
    } else if (financial.income_statement?.net_income?.gaap?.value) {
      netIncome = financial.income_statement.net_income.gaap.value;
    }

    // Try different margin field names
    if (financial.income_statement?.margins?.gross_margin?.current_value) {
      grossMargin = financial.income_statement.margins.gross_margin.current_value;
    } else if (financial.income_statement?.margins?.gross_margin?.gaap?.value) {
      grossMargin = financial.income_statement.margins.gross_margin.gaap.value;
    }

    if (financial.income_statement?.margins?.operating_margin?.current_value) {
      operatingMargin = financial.income_statement.margins.operating_margin.current_value;
    } else if (financial.income_statement?.margins?.operating_margin?.gaap?.value) {
      operatingMargin = financial.income_statement.margins.operating_margin.gaap.value;
    }

    return {
      period: {
        fiscalYear: financial.period?.fiscal_quarter?.split(' ')[1] || null,
        quarter: financial.period?.fiscal_quarter?.split(' ')[0] || null,
        endDate: financial.period?.fiscal_end_date || null
      },
      revenue: {
        total: revenue,
        qoqGrowth: financial.income_statement?.revenue?.total?.qoq_growth || 0,
        yoyGrowth: financial.income_statement?.revenue?.total?.yoy_growth || 0,
        segments: financial.income_statement?.revenue?.by_segment || {}
      },
      margins: {
        grossMargin: grossMargin,
        operatingMargin: operatingMargin
      },
      netIncome: netIncome,
      cashFlow: {
        operating: financial.cash_flow?.operating_cash_flow || 0,
        free: financial.cash_flow?.free_cash_flow || 0
      }
    };
  }

  // Get time series data for charting
  async getTimeSeriesData(company, metrics = ['revenue', 'netIncome'], quarters = 6) {
    const timeSeriesData = {
      labels: [],
      datasets: {}
    };

    // Initialize datasets
    metrics.forEach(metric => {
      timeSeriesData.datasets[metric] = [];
    });

    // Get available fiscal years and quarters
    const companyDir = path.join(this.baseDir, company);
    if (!fs.existsSync(companyDir)) return timeSeriesData;

    const fiscalYears = fs.readdirSync(companyDir)
      .filter(dir => dir.startsWith('FY_'))
      .sort()
      .reverse()
      .slice(0, 2); // Get last 2 years for 4 quarters total

    let dataPoints = 0;
    
    for (const fyDir of fiscalYears) {
      const fiscalYear = fyDir.replace('FY_', '');
      const fyPath = path.join(companyDir, fyDir);
      
      const quarters = fs.readdirSync(fyPath)
        .filter(dir => dir.startsWith('Q'))
        .sort()
        .reverse()
        .slice(0, 4); // Get all 4 quarters per year

      for (const qDir of quarters) {
        if (dataPoints >= quarters) break;
        
        const quarter = qDir.replace('Q', '');
        const data = await this.getFinancialData(company, fiscalYear, quarter);
        
        if (data) {
          const label = `FY${fiscalYear} Q${quarter}`;
          timeSeriesData.labels.unshift(label); // Add to beginning for chronological order
          
          metrics.forEach(metric => {
            let value = 0;
            switch (metric) {
              case 'revenue':
                value = data.revenue.total / 1000; // Convert millions to billions
                break;
              case 'netIncome':
                value = data.netIncome / 1000; // Convert millions to billions
                break;
              case 'grossMargin':
                value = data.margins.grossMargin; // Keep as percentage
                break;
              case 'operatingMargin':
                value = data.margins.operatingMargin; // Keep as percentage
                break;
              case 'operatingCashFlow':
                value = data.cashFlow.operating / 1000; // Convert millions to billions
                break;
              case 'freeCashFlow':
                value = data.cashFlow.free / 1000; // Convert millions to billions
                break;
            }
            timeSeriesData.datasets[metric].unshift(value);
          });
          
          dataPoints++;
        }
      }
    }

    return timeSeriesData;
  }

  // Generate chart configuration for Chart.js
  generateChartConfig(timeSeriesData, chartType = 'line', title = '') {
    const colors = {
      revenue: '#3B82F6',
      netIncome: '#10B981',
      grossMargin: '#F59E0B',
      operatingMargin: '#EF4444',
      operatingCashFlow: '#8B5CF6',
      freeCashFlow: '#06B6D4'
    };

    const datasets = Object.keys(timeSeriesData.datasets).map(metric => ({
      label: this.formatMetricName(metric),
      data: timeSeriesData.datasets[metric],
      borderColor: colors[metric] || '#6B7280',
      backgroundColor: colors[metric] || '#6B7280',
      tension: 0.1,
      fill: false
    }));

    return {
      type: chartType,
      data: {
        labels: timeSeriesData.labels,
        datasets
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: !!title,
            text: title,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                // Check if this is a percentage metric
                const isPercentage = this.chart.data.datasets.some(dataset => 
                  dataset.label.includes('Margin') || dataset.label.includes('%')
                );
                
                if (isPercentage) {
                  return value.toFixed(1) + '%';
                } else {
                  return '$' + value.toFixed(1) + 'B';
                }
              }
            }
          }
        }
      }
    };
  }

  formatMetricName(metric) {
    const names = {
      revenue: 'Revenue',
      netIncome: 'Net Income',
      grossMargin: 'Gross Margin %',
      operatingMargin: 'Operating Margin %',
      operatingCashFlow: 'Operating Cash Flow',
      freeCashFlow: 'Free Cash Flow'
    };
    return names[metric] || metric;
  }

  // Get segment breakdown data for pie charts
  async getSegmentData(company, fiscalYear, quarter) {
    const data = await this.getFinancialData(company, fiscalYear, quarter);
    if (!data) return null;

    // Try different segment field names
    let segments = null;
    if (data.revenue.segments && Object.keys(data.revenue.segments).length > 0) {
      segments = data.revenue.segments;
    } else {
      // Try to get segments from the raw data
      const rawData = await this.getRawFinancialData(company, fiscalYear, quarter);
      if (rawData?.financial_report?.income_statement?.sales_by_category) {
        segments = rawData.financial_report.income_statement.sales_by_category;
      } else if (rawData?.financial_report?.income_statement?.sales_by_segment) {
        segments = rawData.financial_report.income_statement.sales_by_segment;
      }
    }

    if (!segments) return null;

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    return {
      labels: Object.keys(segments).filter(key => key !== 'total').map(segment => 
        segment.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      ),
      datasets: [{
        data: Object.entries(segments)
          .filter(([key]) => key !== 'total')
          .map(([key, segment]) => segment.value || 0),
        backgroundColor: colors.slice(0, Object.keys(segments).length - 1), // -1 for total
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };
  }

  // Get raw financial data for additional processing
  async getRawFinancialData(company, fiscalYear, quarter) {
    try {
      const filePath = path.join(this.baseDir, company, `FY_${fiscalYear}`, `Q${quarter}`, `${company}_FY_${fiscalYear}_Q${quarter}.json`);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error(`Error reading raw financial data for ${company} FY${fiscalYear} Q${quarter}:`, error);
      return null;
    }
  }
} 