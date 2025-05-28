
  const TableView = {
    render(data) {
      const container = document.getElementById('table-view');
      container.innerHTML = '';
      
      if (!data || data.length === 0) {
        this.renderMessage('No data to display');
        return;
      }
      
      const table = document.createElement('table');
      table.className = 'data-table';
      
      // Create header
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      Object.keys(data[0]).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        headerRow.appendChild(th);
      });
      
      thead.appendChild(headerRow);
      table.appendChild(thead);
      
      // Create body
      const tbody = document.createElement('tbody');
      
      data.forEach(row => {
        const tr = document.createElement('tr');
        
        Object.values(row).forEach(value => {
          const td = document.createElement('td');
          td.textContent = value !== null ? value : 'NULL';
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
      });
      
      table.appendChild(tbody);
      container.appendChild(table);
    },
    
    renderMessage(message) {
      const container = document.getElementById('table-view');
      container.innerHTML = `<div class="message">${message}</div>`;
    }
  };
  