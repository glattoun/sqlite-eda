
const ScatterChart = {
  render(data, options = {}) {
    const container = document.getElementById('scatter-chart');
    container.innerHTML = '';
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="message">No data to display</div>';
      return;
    }
    
    // Find numeric columns for x and y axes
    const columns = Object.keys(data[0]);
    const numericColumns = columns.filter(col => {
      return data.every(row => row[col] === null || !isNaN(row[col]));
    });
    
    if (numericColumns.length < 2) {
      container.innerHTML = '<div class="message">Need at least two numeric columns for a scatter plot</div>';
      return;
    }
    
    // Use the first two numeric columns by default or provided options
    const xColumn = options.xColumn || numericColumns[0];
    const yColumn = options.yColumn || numericColumns[1];
    
    // Extract values, ignoring nulls
    const points = data.filter(row => 
      row[xColumn] !== null && 
      row[yColumn] !== null && 
      !isNaN(Number(row[xColumn])) && 
      !isNaN(Number(row[yColumn]))
    ).map(row => ({
      x: Number(row[xColumn]),
      y: Number(row[yColumn]),
      originalData: row
    }));
    
    if (points.length === 0) {
      container.innerHTML = '<div class="message">No valid data points for scatter plot</div>';
      return;
    }
    
    // Setup dimensions
    const margin = { top: 40, right: 30, bottom: 80, left: 60 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#scatter-chart')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);
    
    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', '600')
      .style('fill', '#5c6b8a')
      .text(options.title || `${xColumn} vs ${yColumn}`);
    
    // X scale
    const x = d3.scaleLinear()
      .domain([
        d3.min(points, d => d.x) * 0.9,
        d3.max(points, d => d.x) * 1.1
      ])
      .nice()
      .range([0, width]);
    
    // Y scale
    const y = d3.scaleLinear()
      .domain([
        d3.min(points, d => d.y) * 0.9,
        d3.max(points, d => d.y) * 1.1
      ])
      .nice()
      .range([height, 0]);

    // Add gradient for dots
    const gradient = svg.append('defs')
      .append('radialGradient')
      .attr('id', 'scatter-gradient')
      .attr('cx', '30%')
      .attr('cy', '30%');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#a2b8d2');
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#5c6b8a');
    
    // Add dots
    svg.selectAll('.dot')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.x))
      .attr('cy', d => y(d.y))
      .attr('r', 6)
      .attr('fill', 'url(#scatter-gradient)')
      .attr('stroke', '#5c6b8a')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 9).attr('fill', '#f07838');
        tooltip.style('opacity', 1)
          .html(`<strong>${xColumn}:</strong> ${d.x.toLocaleString()}<br/><strong>${yColumn}:</strong> ${d.y.toLocaleString()}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mousemove', function(event) {
        tooltip.style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('r', 6).attr('fill', 'url(#scatter-gradient)');
        tooltip.style('opacity', 0);
      });
    
    // Add X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('text-anchor', 'end')
      .style('font-size', '11px');
    
    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('font-size', '11px');
    
    // Add X axis label
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#5c6b8a')
      .text(xColumn);
    
    // Add Y axis label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#5c6b8a')
      .text(yColumn);
    
    // Add point count
    svg.append('text')
      .attr('x', width - 10)
      .attr('y', 20)
      .attr('text-anchor', 'end')
      .style('font-size', '12px')
      .style('fill', '#5c6b8a')
      .text(`n = ${points.length} points`);
    
    // Add optional trend line
    if (points.length > 1 && options.showTrendLine !== false) {
      // Calculate trend line
      const xValues = points.map(d => d.x);
      const yValues = points.map(d => d.y);
      
      // Calculate linear regression
      const n = xValues.length;
      const xMean = xValues.reduce((a, b) => a + b, 0) / n;
      const yMean = yValues.reduce((a, b) => a + b, 0) / n;
      
      let numerator = 0;
      let denominator = 0;
      
      for (let i = 0; i < n; i++) {
        numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
        denominator += Math.pow(xValues[i] - xMean, 2);
      }
      
      const slope = denominator ? numerator / denominator : 0;
      const intercept = yMean - slope * xMean;
      
      // Add regression line
      const x1 = d3.min(xValues);
      const y1 = slope * x1 + intercept;
      const x2 = d3.max(xValues);
      const y2 = slope * x2 + intercept;
      
      svg.append('line')
        .attr('x1', x(x1))
        .attr('y1', y(y1))
        .attr('x2', x(x2))
        .attr('y2', y(y2))
        .attr('stroke', '#f07838')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
      
      // Display correlation coefficient
      const xSigma = Math.sqrt(xValues.map(x => Math.pow(x - xMean, 2)).reduce((a, b) => a + b, 0) / n);
      const ySigma = Math.sqrt(yValues.map(y => Math.pow(y - yMean, 2)).reduce((a, b) => a + b, 0) / n);
      
      let correlation = 0;
      if (xSigma !== 0 && ySigma !== 0) {
        correlation = numerator / (n * xSigma * ySigma);
      }
      
      svg.append('text')
        .attr('x', width - 10)
        .attr('y', 40)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .style('fill', '#5c6b8a')
        .text(`r = ${correlation.toFixed(4)}`);
    }
  },
  
  clear() {
    document.getElementById('scatter-chart').innerHTML = '';
    // Remove any existing tooltips
    d3.selectAll('.chart-tooltip').remove();
  }
};