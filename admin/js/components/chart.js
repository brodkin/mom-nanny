/**
 * Chart Component - Wrapper for Chart.js with real-time updates and animations
 * 
 * @class Chart
 * @extends EventTarget
 * 
 * @example
 * const chart = new Chart({
 *   type: 'line',
 *   data: {
 *     labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
 *     datasets: [{
 *       label: 'Sales',
 *       data: [10, 20, 15, 25, 30],
 *       borderColor: '#3498db'
 *     }]
 *   },
 *   options: {
 *     responsive: true,
 *     animation: {
 *       duration: 1000
 *     }
 *   }
 * });
 * 
 * chart.on('dataUpdate', (e) => {
 *   console.log('Chart updated with new data');
 * });
 * 
 * document.body.appendChild(chart.element);
 */
export class Chart extends EventTarget {
  /**
   * Create a Chart instance
   * @param {Object} options - Chart configuration options
   * @param {string} [options.type='line'] - Chart type (line, bar, doughnut, pie, etc.)
   * @param {Object} options.data - Chart data object
   * @param {Object} [options.options={}] - Chart.js options
   * @param {boolean} [options.responsive=true] - Make chart responsive
   * @param {boolean} [options.maintainAspectRatio=true] - Maintain aspect ratio
   * @param {number} [options.width=400] - Chart width (if not responsive)
   * @param {number} [options.height=300] - Chart height (if not responsive)
   * @param {string} [options.className=''] - Additional CSS classes
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {},
      responsive: true,
      maintainAspectRatio: true,
      width: 400,
      height: 300,
      className: '',
      ...options
    };
    
    this.chartInstance = null;
    this.updateQueue = [];
    this.isUpdating = false;
    
    this.element = this.createElement();
    this.loadChartJS().then(() => {
      this.initChart();
    });
  }

  /**
   * Create the chart container DOM element
   * @private
   * @returns {HTMLElement} The chart container element
   */
  createElement() {
    const container = document.createElement('div');
    container.className = `chart-container ${this.options.className}`.trim();
    
    const canvas = document.createElement('canvas');
    canvas.className = 'chart-canvas';
    
    if (!this.options.responsive) {
      canvas.width = this.options.width;
      canvas.height = this.options.height;
    }
    
    container.appendChild(canvas);
    return container;
  }

  /**
   * Load Chart.js library dynamically
   * @private
   * @returns {Promise} Promise that resolves when Chart.js is loaded
   */
  async loadChartJS() {
    if (typeof Chart !== 'undefined') {
      this.ChartJS = Chart;
      return;
    }
    
    // Try to load from CDN if not already available
    if (typeof window !== 'undefined' && !window.Chart) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
      
      return new Promise((resolve, reject) => {
        script.onload = () => {
          this.ChartJS = window.Chart;
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } else {
      this.ChartJS = window.Chart || Chart;
    }
  }

  /**
   * Initialize the Chart.js instance
   * @private
   */
  initChart() {
    if (!this.ChartJS) {
      console.error('Chart.js library not loaded');
      return;
    }
    
    const canvas = this.element.querySelector('.chart-canvas');
    const ctx = canvas.getContext('2d');
    
    const defaultOptions = {
      responsive: this.options.responsive,
      maintainAspectRatio: this.options.maintainAspectRatio,
      animation: {
        duration: 750,
        easing: 'easeInOutQuart'
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false
        }
      },
      ...this.options.options
    };
    
    this.chartInstance = new this.ChartJS(ctx, {
      type: this.options.type,
      data: this.options.data,
      options: defaultOptions
    });
    
    this.bindChartEvents();
    this.dispatchEvent(new CustomEvent('chartReady', {
      detail: { chart: this.chartInstance }
    }));
  }

  /**
   * Bind Chart.js events
   * @private
   */
  bindChartEvents() {
    if (!this.chartInstance) return;
    
    const canvas = this.element.querySelector('.chart-canvas');
    
    // Click events
    canvas.addEventListener('click', (event) => {
      const points = this.chartInstance.getElementsAtEventForMode(
        event, 'nearest', { intersect: true }, false
      );
      
      if (points.length > 0) {
        const point = points[0];
        const datasetIndex = point.datasetIndex;
        const index = point.index;
        const value = this.chartInstance.data.datasets[datasetIndex].data[index];
        const label = this.chartInstance.data.labels[index];
        
        this.dispatchEvent(new CustomEvent('pointClick', {
          detail: { datasetIndex, index, value, label, point }
        }));
      }
    });
    
    // Hover events
    canvas.addEventListener('mousemove', (event) => {
      const points = this.chartInstance.getElementsAtEventForMode(
        event, 'nearest', { intersect: false }, false
      );
      
      if (points.length > 0) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    });
  }

  /**
   * Update chart data
   * @param {Object} newData - New chart data
   * @param {boolean} [animate=true] - Whether to animate the update
   */
  updateData(newData, animate = true) {
    if (!this.chartInstance) {
      this.updateQueue.push({ data: newData, animate });
      return;
    }
    
    this.isUpdating = true;
    
    // Merge new data with existing data
    if (newData.labels) {
      this.chartInstance.data.labels = [...newData.labels];
    }
    
    if (newData.datasets) {
      newData.datasets.forEach((newDataset, index) => {
        if (this.chartInstance.data.datasets[index]) {
          Object.assign(this.chartInstance.data.datasets[index], newDataset);
        } else {
          this.chartInstance.data.datasets.push(newDataset);
        }
      });
    }
    
    this.chartInstance.update(animate ? 'active' : 'none');
    
    this.dispatchEvent(new CustomEvent('dataUpdate', {
      detail: { data: this.chartInstance.data }
    }));
    
    this.isUpdating = false;
  }

  /**
   * Add data point to existing datasets
   * @param {string|number} label - Label for the new data point
   * @param {Array|number} values - Values for each dataset (array) or single value
   * @param {boolean} [removeFirst=false] - Remove first point to maintain size
   */
  addDataPoint(label, values, removeFirst = false) {
    if (!this.chartInstance) return;
    
    const valuesArray = Array.isArray(values) ? values : [values];
    
    // Add label
    this.chartInstance.data.labels.push(label);
    
    // Add data points
    this.chartInstance.data.datasets.forEach((dataset, index) => {
      const value = valuesArray[index] || 0;
      dataset.data.push(value);
    });
    
    // Remove first point if requested
    if (removeFirst) {
      this.chartInstance.data.labels.shift();
      this.chartInstance.data.datasets.forEach(dataset => {
        dataset.data.shift();
      });
    }
    
    this.chartInstance.update('active');
    
    this.dispatchEvent(new CustomEvent('pointAdded', {
      detail: { label, values: valuesArray }
    }));
  }

  /**
   * Remove data point
   * @param {number} index - Index of point to remove
   */
  removeDataPoint(index) {
    if (!this.chartInstance) return;
    
    this.chartInstance.data.labels.splice(index, 1);
    this.chartInstance.data.datasets.forEach(dataset => {
      dataset.data.splice(index, 1);
    });
    
    this.chartInstance.update('active');
    
    this.dispatchEvent(new CustomEvent('pointRemoved', {
      detail: { index }
    }));
  }

  /**
   * Update chart options
   * @param {Object} newOptions - New chart options
   */
  updateOptions(newOptions) {
    if (!this.chartInstance) return;
    
    Object.assign(this.chartInstance.options, newOptions);
    this.chartInstance.update('none');
    
    this.dispatchEvent(new CustomEvent('optionsUpdate', {
      detail: { options: this.chartInstance.options }
    }));
  }

  /**
   * Change chart type
   * @param {string} newType - New chart type
   */
  changeType(newType) {
    if (!this.chartInstance) return;
    
    this.chartInstance.config.type = newType;
    this.chartInstance.update('active');
    
    this.dispatchEvent(new CustomEvent('typeChange', {
      detail: { type: newType }
    }));
  }

  /**
   * Get chart as image
   * @param {string} [format='image/png'] - Image format
   * @param {number} [quality=1] - Image quality (0-1)
   * @returns {string} Data URL of the chart image
   */
  toImage(format = 'image/png', quality = 1) {
    if (!this.chartInstance) return null;
    
    const canvas = this.element.querySelector('.chart-canvas');
    return canvas.toDataURL(format, quality);
  }

  /**
   * Download chart as image
   * @param {string} [filename='chart'] - Download filename (without extension)
   * @param {string} [format='png'] - Image format
   */
  downloadImage(filename = 'chart', format = 'png') {
    const dataUrl = this.toImage(`image/${format}`);
    if (!dataUrl) return;
    
    const link = document.createElement('a');
    link.download = `${filename}.${format}`;
    link.href = dataUrl;
    link.click();
    
    this.dispatchEvent(new CustomEvent('imageDownload', {
      detail: { filename, format }
    }));
  }

  /**
   * Start real-time updates
   * @param {Function} dataProvider - Function that returns new data
   * @param {number} [interval=1000] - Update interval in milliseconds
   */
  startRealTime(dataProvider, interval = 1000) {
    if (this.realTimeInterval) {
      this.stopRealTime();
    }
    
    this.realTimeInterval = setInterval(() => {
      const newData = dataProvider();
      if (newData) {
        this.updateData(newData);
      }
    }, interval);
    
    this.dispatchEvent(new CustomEvent('realTimeStart', {
      detail: { interval }
    }));
  }

  /**
   * Stop real-time updates
   */
  stopRealTime() {
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
      this.realTimeInterval = null;
      
      this.dispatchEvent(new CustomEvent('realTimeStop'));
    }
  }

  /**
   * Resize chart
   */
  resize() {
    if (this.chartInstance) {
      this.chartInstance.resize();
    }
  }

  /**
   * Get chart data
   * @returns {Object} Current chart data
   */
  getData() {
    return this.chartInstance ? this.chartInstance.data : null;
  }

  /**
   * Get chart options
   * @returns {Object} Current chart options
   */
  getOptions() {
    return this.chartInstance ? this.chartInstance.options : null;
  }

  /**
   * Show/hide dataset
   * @param {number} datasetIndex - Index of dataset to toggle
   * @param {boolean} [visible] - Visibility state (toggles if not provided)
   */
  toggleDataset(datasetIndex, visible) {
    if (!this.chartInstance) return;
    
    const meta = this.chartInstance.getDatasetMeta(datasetIndex);
    if (meta) {
      meta.hidden = visible !== undefined ? !visible : !meta.hidden;
      this.chartInstance.update('active');
      
      this.dispatchEvent(new CustomEvent('datasetToggle', {
        detail: { datasetIndex, hidden: meta.hidden }
      }));
    }
  }

  /**
   * Reset zoom (if zoom plugin is available)
   */
  resetZoom() {
    if (this.chartInstance && this.chartInstance.resetZoom) {
      this.chartInstance.resetZoom();
    }
  }

  /**
   * Add event listener (alias for addEventListener)
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    this.addEventListener(event, handler);
  }

  /**
   * Remove event listener (alias for removeEventListener)
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    this.removeEventListener(event, handler);
  }

  /**
   * Destroy the chart and clean up
   */
  destroy() {
    this.stopRealTime();
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export default Chart;