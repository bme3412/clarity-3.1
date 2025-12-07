'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

export default function FinancialChart({ chartData, chartType = 'line', title = '', height = '400px' }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartData || !chartRef.current) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Create new chart
    const ctx = chartRef.current.getContext('2d');
    chartInstance.current = new Chart(ctx, {
      type: chartType,
      data: chartData.data,
      options: {
        ...chartData.options,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...chartData.options?.plugins,
          title: {
            display: !!title,
            text: title,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [chartData, chartType, title]);

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No chart data available</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border p-4">
      <div style={{ height }}>
        <canvas ref={chartRef} />
      </div>
    </div>
  );
}

// Chart container component for multiple charts
export function ChartContainer({ children, title = '' }) {
  return (
    <div className="space-y-6">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {children}
      </div>
    </div>
  );
} 