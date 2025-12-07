import React from 'react';

const StructuredFinancialTable = ({ data }) => {
  if (!data || !data.tableData) {
    return (
      <div className="text-gray-500 text-center py-8">
        No financial data available
      </div>
    );
  }

  const { tableData, highlights, trends, summary } = data;
  
  // Detect if this is a cash flow analysis based on the table title
  const isCashFlowAnalysis = tableData.title.toLowerCase().includes('cash flow');

  const formatValue = (value, isPercentage = false) => {
    if (value === null || value === undefined || value === 0) {
      return '-';
    }
    
    if (isPercentage) {
      return `${value.toFixed(1)}%`;
    }
    
    // Format as currency in millions/billions
    // Since the data is stored in millions, we need to handle the scaling properly
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      // Value is in millions, convert to billions
      return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(1)}B`;
    } else {
      // Value is in millions, keep as millions
      return `${value < 0 ? '-' : ''}$${absValue.toFixed(0)}M`;
    }
  };

  const isPercentageMetric = (metric) => {
    return metric.toLowerCase().includes('margin') || 
           metric.toLowerCase().includes('growth') ||
           metric.toLowerCase().includes('%');
  };

  const isYoYChangeColumn = (columnIndex, headers) => {
    const result = headers && headers[columnIndex] && headers[columnIndex].toLowerCase().includes('yoy change');
    console.log(`isYoYChangeColumn(${columnIndex}, [${headers}]) = ${result}`);
    console.log(`Headers: ${JSON.stringify(headers)}`);
    console.log(`Column ${columnIndex}: ${headers?.[columnIndex]}`);
    return result;
  };

  const isChangeColumn = (columnIndex, headers) => {
    const result = headers && headers[columnIndex] && headers[columnIndex].toLowerCase() === 'change';
    return result;
  };

  return (
    <div className="space-y-6">
      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h3 className="text-xl font-bold text-white">
            {tableData.title}
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700">
              <tr>
                {tableData.headers.map((header, index) => (
                  <th 
                    key={index}
                    className={`px-6 py-4 text-sm font-bold text-white border-r border-blue-500 ${
                      index === 0 ? 'text-left' : 'text-center'
                    } ${index === tableData.headers.length - 1 ? 'border-r-0' : ''}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tableData.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white hover:bg-blue-50 transition-colors' : 'bg-gray-50 hover:bg-blue-50 transition-colors'}>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 border-r border-gray-200 bg-gray-50">
                    {row.metric}
                  </td>
                  {row.values.map((value, cellIndex) => (
                    <td 
                      key={cellIndex}
                      className="px-6 py-4 text-sm text-gray-900 text-center border-r border-gray-200 last:border-r-0"
                    >
                      <span className={`font-medium ${
                        value === null || value === 0 ? 'text-gray-500' : 'text-gray-900'
                      }`}>
                        {(() => {
                          // Adjust column index: cellIndex 0 = Q1 2024, cellIndex 1 = Q1 2023, cellIndex 2 = Change
                          // So Change is at header index cellIndex + 1
                          const headerIndex = cellIndex + 1;
                          const isChangeCol = isChangeColumn(headerIndex, tableData.headers);
                          const isYoYChangeCol = isYoYChangeColumn(headerIndex, tableData.headers);
                          
                          // For "Change" column: use percentage for margins, currency for revenue/income
                          let isPercentage = isPercentageMetric(row.metric);
                          if (isChangeCol) {
                            isPercentage = row.metric.toLowerCase().includes('margin');
                          } else if (isYoYChangeCol) {
                            isPercentage = true; // YoY Change columns are always percentages
                          }
                          
                          console.log(`formatValue for ${row.metric} at column ${cellIndex} (header ${headerIndex}): value=${value}, isPercentage=${isPercentage}, isChangeCol=${isChangeCol}`);
                          return formatValue(value, isPercentage);
                        })()}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Summary Section */}
        {summary && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-200 p-4">
            <h5 className="text-sm font-semibold text-blue-900 mb-3">Latest Quarter Summary</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {Object.entries(summary).map(([key, value]) => {
                const metricName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const formattedValue = formatValue(value, isPercentageMetric(metricName));
                
                return (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-blue-700 font-medium">{metricName}:</span>
                    <span className="text-blue-900 font-bold">{formattedValue}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Trends Section */}
      {trends && trends.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4 border-b-2 border-blue-600 pb-2">
            Quarterly Trends
          </h4>
          <div className="space-y-3">
            {trends.map((trend, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">{trend.quarter}:</span>
                <div className="text-sm text-gray-600">
                  {isCashFlowAnalysis ? (
                    <>
                      <span className="mr-4">Op. Cash Flow: {formatValue(trend.revenue)}</span>
                      <span className="mr-4">Free Cash Flow: {formatValue(trend.profit)}</span>
                      <span>Cash Flow Margin: {formatValue(trend.margin, true)}</span>
                    </>
                  ) : (
                    <>
                      <span className="mr-4">Revenue: {formatValue(trend.revenue)}</span>
                      <span className="mr-4">Profit: {formatValue(trend.profit)}</span>
                      <span>Margin: {formatValue(trend.margin, true)}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Highlights Section */}
      {highlights && highlights.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4 border-b-2 border-blue-600 pb-2">
            Performance Highlights
          </h4>
          <ul className="space-y-2">
            {highlights.map((highlight, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-600 mr-2 mt-1">•</span>
                <span className="text-gray-700">{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default StructuredFinancialTable; 