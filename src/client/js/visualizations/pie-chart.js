
  const PieChart = {
    render(data) {
      const container = document.getElementById('pie-chart');
      container.innerHTML = '';
      
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="message">No data to display</div>';
        return;
      }
      
      // PieChart works best with categorical data and count/sum
      const columns = Object.keys(data[0]);
      
      // Find numeric columns for values
      const numericColumns = columns.filter(col => {
        return data.every(row => row[col] === null || !isNaN(row[col]));
      });
      
      if (numericColumns.length === 0) {
        container.innerHTML = '<div class="message">No numeric columns found for visualization</div>';
        return;
      }
      
      // Select a non-numeric column for labels
      const nonNumericColumns = columns.filter(col => !numericColumns.includes(col));
      
      if (nonNumericColumns.length === 0) {
        container.innerHTML = '<div class="message">No categorical columns found for pie chart labels</div>';
        return;
      }
      
      const labelColumn = nonNumericColumns[0];
      const valueColumn = numericColumns[0];
      
      // Aggregate data if there are duplicate labels
      const aggregatedData = {};
      data.forEach(row => {
        const label = row[labelColumn];
        if (!aggregatedData[label]) {
          aggregatedData[label] = 0;
        }
        aggregatedData[label] += +row[valueColumn];
      });
      
      const pieData = Object.entries(aggregatedData).map(([key, value]) => ({
        label: key,
        value: value
      }));
      
      // Setup dimensions
      const width = container.clientWidth;
      const height = 400;
      const radius = Math.min(width, height) / 2 - 60;
      
      // Create SVG
      const svg = d3.select('#pie-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

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
      
      // Modern color palette using shades of the requested colors
      const colorScale = d3.scaleOrdinal()
        .range(['#5c6b8a', '#a2b8d2', '#f5c9a8', '#f07838', '#ba4c40', '#708db5', '#d4a574', '#e69652', '#a0564b']);
      
      // Pie generator
      const pie = d3.pie()
        .value(d => d.value)
        .sort(null);
      
      // Arc generator
      const arc = d3.arc()
        .innerRadius(radius * 0.4)
        .outerRadius(radius);

      // Arc generator for hover effect
      const arcHover = d3.arc()
        .innerRadius(radius * 0.4)
        .outerRadius(radius + 10);
      
      // Add slices
      const slices = svg.selectAll('.slice')
        .data(pie(pieData))
        .enter()
        .append('g')
        .attr('class', 'slice');
      
      slices.append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => colorScale(i))
        .attr('stroke', 'white')
        .style('stroke-width', '3px')
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).attr('d', arcHover);
          const percent = Math.round(d.data.value / d3.sum(pieData, d => d.value) * 100);
          tooltip.style('opacity', 1)
            .html(`<strong>${d.data.label}</strong><br/>${valueColumn}: ${d.data.value.toLocaleString()}<br/><strong>${percent}%</strong>`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mousemove', function(event) {
          tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).attr('d', arc);
          tooltip.style('opacity', 0);
        });

      // Add center text showing total
      const total = d3.sum(pieData, d => d.value);
      svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -5)
        .style('font-size', '18px')
        .style('font-weight', '600')
        .style('fill', '#5c6b8a')
        .text('Total');

      svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 15)
        .style('font-size', '16px')
        .style('fill', '#5c6b8a')
        .text(total.toLocaleString());
      
      // Add title
      svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -height / 2 + 20)
        .text(`${labelColumn} by ${valueColumn}`)
        .style('font-size', '16px')
        .style('font-weight', '600')
        .style('fill', '#5c6b8a');

      // Create legend
      const legend = svg.append('g')
        .attr('transform', `translate(${radius + 20}, ${-pieData.length * 10})`);

      const legendItems = legend.selectAll('.legend-item')
        .data(pieData)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 20})`);

      legendItems.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', (d, i) => colorScale(i));

      legendItems.append('text')
        .attr('x', 18)
        .attr('y', 10)
        .style('font-size', '12px')
        .style('fill', '#5c6b8a')
        .text(d => d.label);
    },
    
    clear() {
      document.getElementById('pie-chart').innerHTML = '';
      // Remove any existing tooltips
      d3.selectAll('.chart-tooltip').remove();
    }
  };