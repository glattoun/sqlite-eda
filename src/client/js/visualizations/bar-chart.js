
  const BarChart = {
    render(data) {
      const container = document.getElementById('bar-chart');
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
      
      // Use first string column as x-axis if available
      const stringColumns = columns.filter(col => {
        return data.every(row => row[col] === null || typeof row[col] === 'string');
      });
      
      const xColumn = stringColumns.length > 0 ? stringColumns[0] : columns[0];
      const yColumn = numericColumns[0];
      
      // Setup dimensions
      const margin = { top: 20, right: 30, bottom: 80, left: 60 };
      const width = container.clientWidth - margin.left - margin.right;
      const height = 400 - margin.top - margin.bottom;
      
      // Create SVG
      const svg = d3.select('#bar-chart')
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
      
      // X scale
      const x = d3.scaleBand()
        .domain(data.map(d => d[xColumn]))
        .range([0, width])
        .padding(0.15);
      
      // Y scale
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => +d[yColumn]) * 1.1])
        .nice()
        .range([height, 0]);
      
      // Add bars with gradient
      const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'bar-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', height)
        .attr('x2', 0).attr('y2', 0);
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#5c6b8a');
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#a2b8d2');

      svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d[xColumn]))
        .attr('y', d => y(+d[yColumn]))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(+d[yColumn]))
        .attr('fill', 'url(#bar-gradient)')
        .attr('stroke', '#5c6b8a')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('fill', '#f07838');
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
          d3.select(this).attr('fill', 'url(#bar-gradient)');
          tooltip.style('opacity', 0);
        });
      
      // Add X axis - only show numeric labels
      const xAxis = svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));
      
      // Handle text labels vs numeric labels differently
      const isNumericX = data.every(row => !isNaN(+row[xColumn]));
      
      if (!isNumericX) {
        // For text labels, hide them to avoid overlap
        xAxis.selectAll('text').remove();
      } else {
        // For numeric labels, show them and rotate if needed
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
      document.getElementById('bar-chart').innerHTML = '';
      // Remove any existing tooltips
      d3.selectAll('.chart-tooltip').remove();
    }
  };
  