
  const LineChart = {
    render(data) {
      const container = document.getElementById('line-chart');
      container.innerHTML = '';
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="message">No data to display</div>';
        return;
      }
      
      // Find numeric columns for y-axis
      const columns = Object.keys(data[0]);
      const numericColumns = columns.filter(col => {
        return data.every(row => row[col] === null || !isNaN(row[col]));
      });
      
      if (numericColumns.length === 0) {
        container.innerHTML = '<div class="message">No numeric columns found for visualization</div>';
        return;
      }
      
      // Use first non-numeric column as x-axis if available
      const nonNumericColumns = columns.filter(col => !numericColumns.includes(col));
      const xColumn = nonNumericColumns.length > 0 ? nonNumericColumns[0] : columns[0];
      const yColumn = numericColumns[0];
      
      // Sort data by x value if possible
      try {
        data.sort((a, b) => {
          if (a[xColumn] < b[xColumn]) return -1;
          if (a[xColumn] > b[xColumn]) return 1;
          return 0;
        });
      } catch (e) {
        // If sorting fails, continue with unsorted data
      }
      
      // Setup dimensions
      const margin = { top: 20, right: 30, bottom: 80, left: 60 };
      const width = container.clientWidth - margin.left - margin.right;
      const height = 400 - margin.top - margin.bottom;
      
      // Create SVG
      const svg = d3.select('#line-chart')
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
      
      // X scale - check if x values are dates
      let x;
      const isDate = data.every(d => !isNaN(Date.parse(d[xColumn])));
      
      if (isDate) {
        x = d3.scaleTime()
          .domain(d3.extent(data, d => new Date(d[xColumn])))
          .range([0, width]);
      } else {
        x = d3.scalePoint()
          .domain(data.map(d => d[xColumn]))
          .range([0, width]);
      }
      
      // Y scale
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => +d[yColumn]) * 1.1])
        .nice()
        .range([height, 0]);

      // Add gradient for line
      const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'line-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', height)
        .attr('x2', 0).attr('y2', 0);
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#5c6b8a');
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#a2b8d2');

      // Add area fill
      const area = d3.area()
        .x(d => x(isDate ? new Date(d[xColumn]) : d[xColumn]))
        .y0(height)
        .y1(d => y(+d[yColumn]));

      svg.append('path')
        .datum(data)
        .attr('fill', 'url(#line-gradient)')
        .attr('opacity', 0.3)
        .attr('d', area);
      
      // Add line
      svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#5c6b8a')
        .attr('stroke-width', 3)
        .attr('d', d3.line()
          .x(d => x(isDate ? new Date(d[xColumn]) : d[xColumn]))
          .y(d => y(+d[yColumn]))
        );
      
      // Add dots
      svg.selectAll('.dot')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', d => x(isDate ? new Date(d[xColumn]) : d[xColumn]))
        .attr('cy', d => y(+d[yColumn]))
        .attr('r', 5)
        .attr('fill', '#5c6b8a')
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('r', 8).attr('fill', '#f07838');
          tooltip.style('opacity', 1)
            .html(`<strong>${d[xColumn]}</strong><br/>${yColumn}: ${(+d[yColumn]).toLocaleString()}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', function(event) {
          tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).attr('r', 5).attr('fill', '#5c6b8a');
          tooltip.style('opacity', 0);
        });
      
      // Add X axis
      const xAxis = svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(isDate ? d3.axisBottom(x) : d3.axisBottom(x));
      
      // Handle text labels vs numeric labels differently
      const isNumericX = data.every(row => !isNaN(+row[xColumn]));
      
      if (!isDate && !isNumericX) {
        // For text labels, hide them to avoid overlap
        xAxis.selectAll('text').remove();
      } else {
        // For numeric/date labels, show them and rotate if needed
        xAxis.selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end')
          .style('font-size', '11px');
      }
      
      // Add Y axis
      svg.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '11px');
      
      // Add labels
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 10)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#5c6b8a')
        .text(xColumn);
      
      svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 15)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('fill', '#5c6b8a')
        .text(yColumn);
    },
    
    clear() {
      document.getElementById('line-chart').innerHTML = '';
      // Remove any existing tooltips
      d3.selectAll('.chart-tooltip').remove();
    }
  };