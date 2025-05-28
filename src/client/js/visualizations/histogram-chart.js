
const HistogramChart = {
  render(data, options = {}) {
    const container = document.getElementById('histogram-chart');
    container.innerHTML = '';
    
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="message">No data to display</div>';
      return;
    }
    
    // Get the column to visualize
    const column = options.column || Object.keys(data[0])[0];
    
    // Extract values, ignoring nulls
    const values = data
      .map(row => row[column])
      .filter(val => val !== null && val !== undefined && !isNaN(Number(val)))
      .map(val => Number(val));
    
    if (values.length === 0) {
      container.innerHTML = '<div class="message">No numeric data to display</div>';
      return;
    }
    
    // Calculate histogram bins
    const binCount = options.bins || 10;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binWidth = range / binCount;
    
    // Create the bins
    const bins = Array(binCount).fill(0);
    values.forEach(value => {
      // Handle edge case for max value
      if (value === max) {
        bins[binCount - 1]++;
        return;
      }
      
      const binIndex = Math.floor((value - min) / binWidth);
      if (binIndex >= 0 && binIndex < binCount) {
        bins[binIndex]++;
      }
    });
    
    // Create bin labels
    const binLabels = Array(binCount).fill().map((_, i) => {
      const start = min + (i * binWidth);
      const end = min + ((i + 1) * binWidth);
      return `${start.toFixed(2)} - ${end.toFixed(2)}`;
    });
    
    // Setup dimensions
    const margin = { top: 30, right: 30, bottom: 80, left: 60 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#histogram-chart')
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
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', '600')
      .style('fill', '#5c6b8a')
      .text(options.title || `Distribution of ${column}`);
    
    // X scale
    const x = d3.scaleBand()
      .domain(binLabels)
      .range([0, width])
      .padding(0.15);
    
    // Y scale
    const y = d3.scaleLinear()
      .domain([0, d3.max(bins) * 1.1])
      .nice()
      .range([height, 0]);

    // Add bars with gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'histogram-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', height)
      .attr('x2', 0).attr('y2', 0);
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#5c6b8a');
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#a2b8d2');
    
    // Add bars
    svg.selectAll('.bar')
      .data(bins)
      .enter()
      .append('rect')
      .attr('class', 'histogram-bar')
      .attr('x', (_, i) => x(binLabels[i]))
      .attr('y', d => y(d))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d))
      .attr('fill', 'url(#histogram-gradient)')
      .attr('stroke', '#5c6b8a')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d, i) {
        const index = Array.from(this.parentNode.children).indexOf(this) - svg.selectAll('defs').size() - svg.selectAll('.domain').size() - svg.selectAll('.tick').size() - 1;
        d3.select(this).attr('fill', '#f07838');
        tooltip.style('opacity', 1)
          .html(`<strong>Range:</strong> ${binLabels[index]}<br/><strong>Count:</strong> ${d}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mousemove', function(event) {
        tooltip.style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill', 'url(#histogram-gradient)');
        tooltip.style('opacity', 0);
      });
    
    // Add X axis - hide text labels to avoid clutter
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .remove();
    
    // Add Y axis
    svg.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('font-size', '11px');
    
    // Add axis labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#5c6b8a')
      .text(column);
    
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#5c6b8a')
      .text('Frequency');
    
    // Add value count
    svg.append('text')
      .attr('x', width - 10)
      .attr('y', 20)
      .attr('text-anchor', 'end')
      .style('font-size', '12px')
      .style('fill', '#5c6b8a')
      .text(`n = ${values.length} values`);
  },
  
  clear() {
    document.getElementById('histogram-chart').innerHTML = '';
    // Remove any existing tooltips
    d3.selectAll('.chart-tooltip').remove();
  }
};