/**
 * Data validation utilities
 */

export function validateQuery(query) {
    if (!query?.trim()) {
      return {
        isValid: false,
        error: 'Query cannot be empty'
      };
    }
  
    if (query.length > 500) {
      return {
        isValid: false,
        error: 'Query exceeds maximum length of 500 characters'
      };
    }
  
    return { isValid: true };
  }
  
  export function validateQuarterlyData(data) {
    const requiredFields = [
      'fiscal_year',
      'quarter',
      'total_revenue',
      'segments',
      'operational_metrics'
    ];
  
    const errors = [];
  
    // Check for required fields
    requiredFields.forEach(field => {
      if (!data[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });
  
    // Validate segments
    if (Array.isArray(data.segments)) {
      data.segments.forEach((segment, index) => {
        if (!segment.name) {
          errors.push(`Segment at index ${index} missing name`);
        }
        if (!segment.revenue) {
          errors.push(`Segment ${segment.name || index} missing revenue`);
        }
      });
    } else {
      errors.push('Segments must be an array');
    }
  
    // Validate revenue
    if (data.total_revenue && typeof data.total_revenue === 'object') {
      if (!data.total_revenue.value || !data.total_revenue.unit) {
        errors.push('Invalid total_revenue format');
      }
    }
  
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  export function validateDataset(dataset) {
    if (!Array.isArray(dataset)) {
      return {
        isValid: false,
        errors: ['Dataset must be an array']
      };
    }
  
    const errors = [];
    dataset.forEach((quarterData, index) => {
      const validation = validateQuarterlyData(quarterData);
      if (!validation.isValid) {
        errors.push(`Quarter ${index} validation failed: ${validation.errors.join(', ')}`);
      }
    });
  
    return {
      isValid: errors.length === 0,
      errors
    };
  }