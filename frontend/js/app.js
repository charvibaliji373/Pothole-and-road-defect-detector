/**
 * RoadVision AI - Master UI Application Orchestrator
 */

class AppController {
  constructor() {
    this.activeTab = 'tab-home';
    this.analyticsLoaded = false;
    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindFlipCards();
    this.bindGuideBoxHover();
    this.initHeroLottie();
    this.checkAndLoadPageLotties();
    this.bindCitizenPortal();
    this.checkBackendHealth();
    this.bindToastContainer();
  }

  initHeroLottie() {
    const container = document.getElementById('hero-lottie-container');
    if (!container) return;
    if (container._lottieInstance) return;

    const loadLottie = () => {
      if (typeof lottie === 'undefined') {
        setTimeout(loadLottie, 150);
        return;
      }

      try {
        const anim = lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: '/public/roadtrip.json',
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
            clearCanvas: false,
            progressiveLoad: true
          }
        });

        anim.addEventListener('data_failed', () => {
          // Fallback to /static/roadtrip.json if /public fails
          lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: '/static/roadtrip.json',
            rendererSettings: {
              preserveAspectRatio: 'xMidYMid meet',
              clearCanvas: false,
              progressiveLoad: true
            }
          });
        });

        container._lottieInstance = anim;
      } catch (err) {
        console.warn('Lottie player initialization error:', err);
      }
    };

    loadLottie();
  }

  loadPageLottie(containerId, jsonPath, fallbackPath) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    if (container._lottieInstance) {
      try { container._lottieInstance.destroy(); } catch (e) {}
    }
    container.innerHTML = '';

    const executeLoad = () => {
      if (typeof lottie === 'undefined') {
        setTimeout(executeLoad, 150);
        return;
      }
      try {
        const anim = lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: jsonPath,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
            clearCanvas: false,
            progressiveLoad: true
          }
        });

        if (fallbackPath) {
          anim.addEventListener('data_failed', () => {
            console.warn(`Primary Lottie load failed for ${containerId}, trying fallback: ${fallbackPath}`);
            lottie.loadAnimation({
              container: container,
              renderer: 'svg',
              loop: true,
              autoplay: true,
              path: fallbackPath,
              rendererSettings: {
                preserveAspectRatio: 'xMidYMid meet',
                clearCanvas: false,
                progressiveLoad: true
              }
            });
          });
        }

        container._lottieInstance = anim;
        return anim;
      } catch (err) {
        console.warn(`Lottie failed for ${containerId}:`, err);
      }
    };
    return executeLoad();
  }

  async checkAndLoadPageLotties() {
    // Exact mapping requested:
    // camera.json for live dashcam page
    // manage.json for municipal kanban
    // analysis.json for pci health analysis
    // detection.json for AI studio
    // map.json for GIS map
    // report.json for citizen portal
    // model.json for specs
    const pageLotties = [
      { id: 'lottie-studio-container', path: '/public/detection.json', fallback: '/static/detection.json' },
      { id: 'lottie-live-container', path: '/public/camera.json', fallback: '/static/camera.json' },
      { id: 'lottie-map-container', path: '/public/map.json', fallback: '/static/map.json' },
      { id: 'lottie-municipal-container', path: '/public/manage.json', fallback: '/static/manage.json' },
      { id: 'lottie-analytics-container', path: '/public/analysis.json', fallback: '/static/analysis.json' },
      { id: 'lottie-citizen-container', path: '/public/report.json', fallback: '/static/report.json' },
      { id: 'lottie-specs-container', path: '/public/model.json', fallback: '/static/model.json' }
    ];

    for (const item of pageLotties) {
      this.loadPageLottie(item.id, item.path, item.fallback);
    }
  }

  bindFlipCards() {
    // Enable flipping anywhere inside any .flip-card across the application
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.flip-card');
      if (!card) return;

      // Do not flip if the user clicked on explicit interactive actions like Zoom Crop thumbnail or links
      if (e.target.closest('.no-flip, .cursor-zoom-in, a[href^="http"], input, textarea, select')) {
        return;
      }

      // If clicked a button inside the card, prevent default to avoid form submission or double execution
      if (e.target.closest('button')) {
        e.preventDefault();
      }

      card.classList.toggle('is-flipped');

      // Audio feedback chime if dashcam HUD audio controller is available
      if (window.hudController && typeof window.hudController.playHudBeep === 'function') {
        window.hudController.playHudBeep(850, 0.03);
      }
    });
  }

  bindGuideBoxHover() {
    // Dynamic interactive mouse sheen for all feature guide boxes
    const updateSheen = (e) => {
      const box = e.currentTarget;
      const rect = box.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      box.style.setProperty('--gx', `${x.toFixed(1)}%`);
      box.style.setProperty('--gy', `${y.toFixed(1)}%`);
    };

    document.querySelectorAll('.feature-guide-box').forEach(box => {
      box._sheenBound = true;
      box.addEventListener('mousemove', updateSheen);
    });
  }

  bindNavigation() {
    const navPills = document.querySelectorAll('.nav-pill');
    navPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const targetTab = pill.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update nav pills
    document.querySelectorAll('.nav-pill').forEach(p => {
      if (p.getAttribute('data-tab') === tabId) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    // Toggle tab panels
    document.querySelectorAll('.tab-content').forEach(content => {
      if (content.id === tabId) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });

    // Special handlers when entering specific tabs
    if (tabId === 'tab-home') {
      this.initHeroLottie();
    } else if (tabId === 'tab-map' && window.gisMapController) {
      window.gisMapController.invalidateSize();
      window.gisMapController.loadDefects();
    } else if (tabId === 'tab-municipal' && window.municipalController) {
      window.municipalController.loadKanbanData();
    } else if (tabId === 'tab-analytics') {
      this.loadAnalyticsCharts();
    }

    // Trigger Lottie resize for newly visible tab to ensure crisp enlarged rendering
    if (typeof lottie !== 'undefined') {
      setTimeout(() => {
        try { lottie.resize(); } catch (e) {}
      }, 50);
    }

    this.bindGuideBoxHover();

    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async checkBackendHealth() {
    const healthBadge = document.getElementById('engine-health-badge');
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (healthBadge) {
          healthBadge.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="text-xs font-mono text-emerald-300">YOLOv8n Active (${data.device})</span>
          `;
        }
      }
    } catch (e) {
      if (healthBadge) {
        healthBadge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span class="text-xs font-mono text-amber-300">Offline / Demo Mode</span>
        `;
      }
    }
  }

  bindCitizenPortal() {
    const form = document.getElementById('citizen-report-form');
    const btnGetLocation = document.getElementById('btn-get-gps-location');
    const inputLat = document.getElementById('citizen-lat');
    const inputLng = document.getElementById('citizen-lng');

    if (btnGetLocation) {
      btnGetLocation.addEventListener('click', () => {
        if (navigator.geolocation) {
          btnGetLocation.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Detecting GPS...`;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              inputLat.value = pos.coords.latitude.toFixed(5);
              inputLng.value = pos.coords.longitude.toFixed(5);
              btnGetLocation.innerHTML = `<i class="fa-solid fa-check text-emerald-400 mr-1"></i> GPS Detected`;
              this.showToast('GPS coordinates acquired successfully!', 'success');
            },
            (err) => {
              btnGetLocation.innerHTML = `<i class="fa-solid fa-location-crosshairs mr-1"></i> Auto GPS`;
              this.showToast('GPS permission denied or unavailable. Using default coordinates.', 'warning');
            }
          );
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Submitting Civic Ticket...`;
        }

        const payload = {
          citizen_name: document.getElementById('citizen-name').value || "Concerned Commuter",
          phone: document.getElementById('citizen-phone').value || "",
          description: document.getElementById('citizen-desc').value || "Road defect requiring repair.",
          landmark: document.getElementById('citizen-landmark').value || "City Boulevard",
          latitude: parseFloat(inputLat.value) || 40.7128,
          longitude: parseFloat(inputLng.value) || -74.0060,
          reported_severity: document.getElementById('citizen-sev').value || "HIGH"
        };

        try {
          const res = await fetch('/api/citizen/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!res.ok) throw new Error('Submission failed');
          const data = await res.json();

          // Show Ticket Confirmation Modal
          this.openTicketConfirmationModal(data.ticket_id, payload);
          form.reset();
        } catch (err) {
          this.showToast(`Report submission failed: ${err.message}`, 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane mr-2"></i> Submit Civic Hazard Report`;
          }
        }
      });
    }
  }

  openTicketConfirmationModal(ticketId, payload) {
    const modal = document.getElementById('ticket-modal');
    if (!modal) return;

    document.getElementById('ticket-id-display').textContent = ticketId;
    document.getElementById('ticket-landmark-display').textContent = payload.landmark;
    document.getElementById('ticket-severity-display').textContent = payload.reported_severity;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Trigger celebratory confetti if library is loaded
    if (window.confetti) {
      window.confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }
  }

  closeTicketConfirmationModal() {
    const modal = document.getElementById('ticket-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async loadAnalyticsCharts() {
    try {
      const res = await fetch('/api/analytics/pci-stats');
      const data = await res.json();
      this.analyticsData = data;

      // Update KPI Telemetry Banner
      const elPciScore = document.getElementById('pci-mean-score');
      const elPciBadge = document.getElementById('pci-mean-badge');
      const elActiveBudget = document.getElementById('pci-active-budget');
      const elActiveBudgetInr = document.getElementById('pci-active-budget-inr');
      const elSavings = document.getElementById('pci-preventive-savings');
      const elLife = document.getElementById('pci-structural-life');
      const elTons = document.getElementById('pci-asphalt-demand');

      if (elPciScore) elPciScore.textContent = (data.average_pci || 100).toFixed(1);
      if (elPciBadge) {
        elPciBadge.textContent = data.network_condition || 'ASTM D6433';
        if (data.average_pci >= 85) elPciBadge.className = 'badge-status badge-low';
        else if (data.average_pci >= 55) elPciBadge.className = 'badge-status badge-medium';
        else if (data.average_pci >= 25) elPciBadge.className = 'badge-status badge-high';
        else elPciBadge.className = 'badge-status badge-critical';
      }
      if (elActiveBudget) elActiveBudget.textContent = `$${Math.round(data.active_budget_usd || 0).toLocaleString()} USD`;
      if (elActiveBudgetInr) elActiveBudgetInr.textContent = `₹${Math.round(data.active_budget_inr || 0).toLocaleString()} INR`;
      if (elSavings) elSavings.textContent = `$${Math.round(data.preventive_savings_usd || 0).toLocaleString()} USD`;
      if (elLife) elLife.textContent = `${data.estimated_structural_life_years || 0} Years`;
      if (elTons) elTons.textContent = `${(data.total_asphalt_tons || 0).toFixed(1)} Tons`;

      // Destroy old charts to prevent canvas re-use errors
      if (!this.charts) this.charts = {};
      Object.keys(this.charts).forEach(key => {
        if (this.charts[key]) {
          try { this.charts[key].destroy(); } catch (e) {}
          this.charts[key] = null;
        }
      });

      if (!window.Chart) return;

      // Chart 1: Severity Breakdown Doughnut
      const ctxSev = document.getElementById('chart-severity-breakdown');
      if (ctxSev) {
        const sev = data.severity_counts || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        this.charts.sev = new Chart(ctxSev, {
          type: 'doughnut',
          data: {
            labels: ['Critical (P0)', 'High (P1)', 'Medium (P2)', 'Low (P3)'],
            datasets: [{
              data: [sev.CRITICAL || 0, sev.HIGH || 0, sev.MEDIUM || 0, sev.LOW || 0],
              backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#10b981'],
              borderColor: '#0f172a',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, font: { family: 'JetBrains Mono', size: 10 } } }
            }
          }
        });
      }

      // Chart 2: Pavement Condition Score vs Maintenance Cost by Corridor
      const ctxPci = document.getElementById('chart-pci-corridors');
      if (ctxPci) {
        const corridors = (data.corridors || []).slice(0, 8);
        const labels = corridors.map(c => (c.name || 'Corridor').split(',')[0].slice(0, 16));
        const pciData = corridors.map(c => c.pci);
        const costData = corridors.map(c => c.cost_usd);

        this.charts.pci = new Chart(ctxPci, {
          type: 'bar',
          data: {
            labels: labels.length ? labels : ['No Corridors'],
            datasets: [
              {
                label: 'PCI Index (0-100)',
                data: pciData.length ? pciData : [100],
                backgroundColor: 'rgba(6, 182, 212, 0.75)',
                borderColor: '#06b6d4',
                borderWidth: 1,
                yAxisID: 'y'
              },
              {
                label: 'Est. Repair Cost ($ USD)',
                data: costData.length ? costData : [0],
                type: 'line',
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.25)',
                borderWidth: 2,
                pointBackgroundColor: '#f59e0b',
                tension: 0.3,
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
              y: { type: 'linear', position: 'left', min: 0, max: 100, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#06b6d4' } },
              y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#f59e0b' } }
            },
            plugins: {
              legend: { labels: { color: '#94a3b8', boxWidth: 12, font: { family: 'JetBrains Mono', size: 10 } } }
            }
          }
        });
      }

      // Chart 3: ASTM D6433 Deterioration Life Cycle Curve
      const ctxCurve = document.getElementById('chart-lifecycle-curve');
      if (ctxCurve) {
        const curvePoints = data.deterioration_curve || [
          { year: 0, pci: 100 }, { year: 2, pci: 92 }, { year: 4, pci: 84 },
          { year: 6, pci: 74 }, { year: 8, pci: 62 }, { year: 10, pci: 48 },
          { year: 12, pci: 31 }, { year: 14, pci: 15 }
        ];

        this.charts.life = new Chart(ctxCurve, {
          type: 'line',
          data: {
            labels: curvePoints.map(p => `Yr ${p.year}`),
            datasets: [
              {
                label: 'Standard ASTM Pavement Decay',
                data: curvePoints.map(p => p.pci),
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                fill: true,
                tension: 0.35,
                borderWidth: 2.5,
                pointRadius: 4,
                pointHoverRadius: 6
              },
              {
                label: 'Current Network Level',
                data: curvePoints.map(() => data.average_pci),
                borderColor: '#06b6d4',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
              y: { min: 0, max: 100, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
            },
            plugins: {
              legend: { labels: { color: '#94a3b8', boxWidth: 12, font: { family: 'JetBrains Mono', size: 10 } } }
            }
          }
        });
      }

      // Chart 4: Civic Repair Pipeline Progress
      const ctxPipeline = document.getElementById('chart-pipeline-flow');
      if (ctxPipeline) {
        const st = data.status_counts || { Reported: 0, 'Inspection Scheduled': 0, 'Work Order Issued': 0, Repaired: 0 };
        this.charts.pipeline = new Chart(ctxPipeline, {
          type: 'bar',
          data: {
            labels: ['01 · Reported', '02 · Scheduled', '03 · Work Order', '04 · Repaired'],
            datasets: [{
              label: 'Active Work Orders',
              data: [
                st['Reported'] || 0,
                st['Inspection Scheduled'] || 0,
                st['Work Order Issued'] || 0,
                st['Repaired'] || 0
              ],
              backgroundColor: [
                'rgba(148, 163, 184, 0.6)',
                'rgba(245, 158, 11, 0.6)',
                'rgba(6, 182, 212, 0.6)',
                'rgba(16, 185, 129, 0.7)'
              ],
              borderColor: ['#94a3b8', '#f59e0b', '#06b6d4', '#10b981'],
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
              x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', stepSize: 1 } },
              y: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { family: 'JetBrains Mono', size: 10 } } }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
      }

      // Bind interactive "What-If" Civil Simulator
      this.bindCivilSimulator(data);

      // Render live corridor distress ledger table
      this.renderCorridorLedger(data.corridors || []);

      this.analyticsLoaded = true;
    } catch (err) {
      console.error('Failed to load deep analytics:', err);
    }
  }

  bindCivilSimulator(data) {
    const slider = document.getElementById('sim-repair-slider');
    const labelVal = document.getElementById('sim-slider-val');
    const labelMax = document.getElementById('sim-max-potholes-label');
    const elProjectedPci = document.getElementById('sim-projected-pci');
    const elPciDelta = document.getElementById('sim-pci-delta');
    const elProjectedLife = document.getElementById('sim-projected-life');
    const elLifeDelta = document.getElementById('sim-life-delta');
    const elProjectedSavings = document.getElementById('sim-projected-savings');

    if (!slider) return;

    const activeDefects = Math.max(1, data.active_defects || 5);
    const basePci = data.average_pci || 50;
    const baseLife = data.estimated_structural_life_years || 3.0;

    slider.max = activeDefects;
    if (labelMax) labelMax.textContent = `${activeDefects} Active Potholes Total`;

    const updateSimulation = () => {
      const repairedCount = parseInt(slider.value, 10);
      if (labelVal) labelVal.textContent = `${repairedCount} Potholes Repaired`;

      const repairRatio = repairedCount / activeDefects;
      const pciGain = (95 - basePci) * repairRatio;
      const simulatedPci = Math.min(95, basePci + pciGain);
      const lifeGain = (14.5 - baseLife) * repairRatio;
      const simulatedLife = Math.min(14.5, baseLife + lifeGain);
      const capitalSaved = (data.active_budget_usd || 1000) * repairRatio * 4.2;

      if (elProjectedPci) elProjectedPci.textContent = simulatedPci.toFixed(1);
      if (elPciDelta) elPciDelta.textContent = `+${pciGain.toFixed(1)} pts`;
      if (elProjectedLife) elProjectedLife.textContent = `${simulatedLife.toFixed(1)} Years`;
      if (elLifeDelta) elLifeDelta.textContent = `+${lifeGain.toFixed(1)} yrs`;
      if (elProjectedSavings) elProjectedSavings.textContent = `$${Math.round(capitalSaved).toLocaleString()} USD`;
    };

    slider.oninput = updateSimulation;
    updateSimulation();
  }

  renderCorridorLedger(corridors) {
    const tbody = document.getElementById('pci-corridor-ledger-body');
    const countChip = document.getElementById('ledger-corridor-count');
    if (!tbody) return;

    if (countChip) countChip.textContent = `${corridors.length} Corridors Audited`;

    if (!corridors.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-slate-500 font-sans">No surveyed road corridors recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = corridors.map(c => `
      <tr class="hover:bg-cyan-500/10 transition-all">
        <td class="py-2.5 px-3 font-mono font-bold text-cyan-400">${c.wo_id || 'WO-SURVEY'}</td>
        <td class="py-2.5 px-3 font-sans text-slate-100 font-medium truncate max-w-[180px]">${c.name}</td>
        <td class="py-2.5 px-3"><span class="badge-status badge-${(c.severity || 'medium').toLowerCase()}">${c.severity}</span></td>
        <td class="py-2.5 px-3 font-bold text-white">${c.defects}</td>
        <td class="py-2.5 px-3 font-bold ${c.pci >= 70 ? 'text-emerald-400' : (c.pci >= 45 ? 'text-amber-400' : 'text-rose-400')}">${c.pci}</td>
        <td class="py-2.5 px-3 text-slate-300">${c.asphalt_tons} T</td>
        <td class="py-2.5 px-3 text-amber-400 font-bold">$${c.cost_usd}</td>
        <td class="py-2.5 px-3"><span class="text-[11px] font-semibold ${c.status === 'Repaired' ? 'text-emerald-400' : 'text-slate-300'}">${c.status}</span></td>
        <td class="py-2.5 px-3 text-right space-x-1">
          <button class="py-1 px-2.5 bg-cyan-600/30 hover:bg-cyan-500/50 border border-cyan-500/40 rounded text-[11px] text-cyan-200 font-bold transition-all"
                  onclick="window.municipalController.openWorkOrderModal('${c.uuid}')">
            PDF & View
          </button>
        </td>
      </tr>
    `).join('');
  }

  bindToastContainer() {
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm';
      document.body.appendChild(container);
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colorClasses = {
      success: 'border-emerald-500/50 text-emerald-200 bg-slate-900/90',
      error: 'border-rose-500/50 text-rose-200 bg-slate-900/90',
      warning: 'border-amber-500/50 text-amber-200 bg-slate-900/90',
      info: 'border-cyan-500/50 text-cyan-200 bg-slate-900/90'
    };

    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info'
    };

    toast.className = `p-3.5 rounded-xl border backdrop-blur-md shadow-2xl flex items-center gap-3 text-xs font-medium animate-bounce transition-all ${colorClasses[type] || colorClasses.info}`;
    toast.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info} text-base"></i>
      <div class="flex-1">${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

window.app = new AppController();
