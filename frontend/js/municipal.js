/**
 * RoadVision AI - Municipal Maintenance Command & Work Order Kanban Controller
 * 100% Dynamic SQLite Persistence, Live Budget Telemetry & Official ReportLab PDF Exports
 */

class MunicipalController {
  constructor() {
    this.inspections = [];
    this.currentModalUuid = null;
    this.filterSeverity = 'ALL';
    this.searchTerm = '';
    this.init();
  }

  init() {
    this.bindSearchAndFilters();
    this.bindCreateWorkOrderModal();
    this.loadKanbanData();
  }

  bindSearchAndFilters() {
    const searchInput = document.getElementById('kanban-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        this.renderKanbanColumns();
      });
    }

    const sevFilter = document.getElementById('kanban-filter-severity');
    if (sevFilter) {
      sevFilter.addEventListener('change', (e) => {
        this.filterSeverity = e.target.value;
        this.renderKanbanColumns();
      });
    }

    const btnExportAll = document.getElementById('btn-export-all-wo');
    if (btnExportAll) {
      btnExportAll.addEventListener('click', () => this.exportAllWorkOrdersCsv());
    }

    const btnOpenCreate = document.getElementById('btn-open-create-wo');
    if (btnOpenCreate) {
      btnOpenCreate.addEventListener('click', () => this.openCreateWorkOrderModal());
    }
  }

  bindCreateWorkOrderModal() {
    const modal = document.getElementById('create-wo-modal');
    const form = document.getElementById('create-wo-form');
    const btnAutoGps = document.getElementById('create-wo-btn-gps');
    const inputLat = document.getElementById('create-wo-lat');
    const inputLng = document.getElementById('create-wo-lng');

    if (btnAutoGps && inputLat && inputLng) {
      btnAutoGps.addEventListener('click', () => {
        if (!navigator.geolocation) {
          window.app.showToast('Geolocation not supported by your browser', 'warning');
          return;
        }
        btnAutoGps.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Detecting...`;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            inputLat.value = pos.coords.latitude.toFixed(5);
            inputLng.value = pos.coords.longitude.toFixed(5);
            btnAutoGps.innerHTML = `<i class="fa-solid fa-check text-emerald-400 mr-1"></i> GPS Set`;
            window.app.showToast('GPS coordinates acquired.', 'success');
          },
          () => {
            btnAutoGps.innerHTML = `<i class="fa-solid fa-crosshairs mr-1"></i> Auto GPS`;
            window.app.showToast('Could not access GPS.', 'warning');
          }
        );
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Creating Work Order...`;
        }

        const payload = {
          location_name: document.getElementById('create-wo-location').value || "Survey Road Corridor",
          latitude: parseFloat(inputLat.value) || 40.7128,
          longitude: parseFloat(inputLng.value) || -74.0060,
          severity: document.getElementById('create-wo-severity').value || "HIGH",
          defect_count: parseInt(document.getElementById('create-wo-count').value, 10) || 1,
          status: document.getElementById('create-wo-initial-status').value || "Reported"
        };

        try {
          const res = await fetch('/api/municipal/work-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!res.ok) throw new Error('Failed to create work order.');
          const data = await res.json();

          window.app.showToast(`Work Order #${data.work_order.work_order_id} created successfully!`, 'success');
          this.closeCreateWorkOrderModal();
          form.reset();

          // Refresh live views
          this.loadKanbanData();
          if (window.gisMapController) {
            window.gisMapController.loadDefects();
          }
          if (window.app && typeof window.app.loadAnalyticsCharts === 'function') {
            window.app.loadAnalyticsCharts();
          }
        } catch (err) {
          window.app.showToast(`Error: ${err.message}`, 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-plus mr-1.5"></i> Dispatch Work Order`;
          }
        }
      });
    }
  }

  openCreateWorkOrderModal() {
    const modal = document.getElementById('create-wo-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeCreateWorkOrderModal() {
    const modal = document.getElementById('create-wo-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async loadKanbanData() {
    try {
      const res = await fetch('/api/inspections');
      const data = await res.json();
      this.inspections = data.inspections || [];
      this.renderKanbanColumns();
      this.updateOverviewMetrics();
    } catch (err) {
      console.error('Failed to load Kanban inspections:', err);
    }
  }

  updateOverviewMetrics() {
    let activeBudgetUsd = 0;
    let activeBudgetInr = 0;
    let totalTons = 0;
    let openCount = 0;
    let repairedCount = 0;

    this.inspections.forEach(i => {
      if (i.status === 'Repaired') {
        repairedCount++;
      } else {
        activeBudgetUsd += (i.estimated_cost_usd || 0);
        activeBudgetInr += (i.estimated_cost_inr || 0);
        totalTons += (i.asphalt_tons || 0);
        openCount++;
      }
    });

    const budgetEl = document.getElementById('kanban-total-budget');
    const tonsEl = document.getElementById('kanban-total-tons');
    const openEl = document.getElementById('kanban-open-tickets');
    const repairedEl = document.getElementById('kanban-repaired-count');

    if (budgetEl) budgetEl.textContent = `$${Math.round(activeBudgetUsd).toLocaleString()} USD`;
    if (tonsEl) tonsEl.textContent = `${totalTons.toFixed(1)} Tons`;
    if (openEl) openEl.textContent = openCount;
    if (repairedEl) repairedEl.textContent = repairedCount;
  }

  renderKanbanColumns() {
    const columns = {
      'Reported': document.getElementById('kanban-col-reported'),
      'Inspection Scheduled': document.getElementById('kanban-col-scheduled'),
      'Work Order Issued': document.getElementById('kanban-col-workorder'),
      'Repaired': document.getElementById('kanban-col-repaired')
    };

    // Clear all column lists
    Object.values(columns).forEach(col => {
      if (col) col.innerHTML = '';
    });

    const nextStatusMap = {
      'Reported': 'Inspection Scheduled',
      'Inspection Scheduled': 'Work Order Issued',
      'Work Order Issued': 'Repaired',
      'Repaired': 'Reported'
    };

    const nextStatusLabels = {
      'Reported': 'Schedule Survey →',
      'Inspection Scheduled': 'Issue Work Order →',
      'Work Order Issued': 'Mark Repaired ✓',
      'Repaired': 'Re-open'
    };

    // Filter items based on active search and severity
    const filtered = this.inspections.filter(item => {
      if (this.filterSeverity !== 'ALL' && item.severity !== this.filterSeverity) {
        return false;
      }
      if (this.searchTerm) {
        const matchesLoc = (item.location_name || '').toLowerCase().includes(this.searchTerm);
        const matchesWo = (item.work_order_id || '').toLowerCase().includes(this.searchTerm);
        if (!matchesLoc && !matchesWo) return false;
      }
      return true;
    });

    filtered.forEach(item => {
      const col = columns[item.status] || columns['Reported'];
      if (!col) return;

      const card = document.createElement('div');
      card.className = 'glass-panel p-4 mb-3 hover-lift border border-white/10 hover:border-cyan-400/50 cursor-pointer transition-all';
      
      const sevClass = `badge-${(item.severity || 'medium').toLowerCase()}`;
      const nextStatus = nextStatusMap[item.status] || 'Repaired';
      const nextLabel = nextStatusLabels[item.status] || 'Advance';

      card.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="text-[11px] font-mono font-bold text-cyan-400">${item.work_order_id}</span>
          <span class="badge-status ${sevClass}">${item.severity}</span>
        </div>
        <div class="text-sm font-semibold text-slate-100 mb-1 leading-snug line-clamp-2">${item.location_name}</div>
        <div class="text-xs text-slate-400 mb-3 flex items-center justify-between">
          <span>PCI: <b class="text-slate-200">${item.pci_score}</b> <small class="text-slate-500">(${item.pci_rating || 'ASTM'})</small></span>
          <span class="font-mono text-amber-400 font-bold">$${item.estimated_cost_usd}</span>
        </div>
        
        <div class="flex items-center gap-2 pt-2 border-t border-white/5">
          <button class="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-medium text-slate-300 transition-all flex items-center gap-1"
                  onclick="event.stopPropagation(); window.municipalController.openWorkOrderModal('${item.uuid}')">
            <i class="fa-solid fa-file-pdf text-[10px] text-rose-400"></i>
            <span>PDF</span>
          </button>
          ${item.status !== 'Repaired' ? `
          <button class="flex-1 py-1 px-2 bg-cyan-600/30 hover:bg-cyan-500/50 border border-cyan-500/40 rounded text-[11px] font-bold text-cyan-200 transition-all"
                  onclick="event.stopPropagation(); window.municipalController.transitionStatus('${item.uuid}', '${nextStatus}')">
            ${nextLabel}
          </button>` : `
          <span class="flex-1 text-[11px] text-emerald-400 font-bold flex items-center justify-center">
            <i class="fa-solid fa-circle-check mr-1"></i> Certified
          </span>
          <button class="py-1 px-2 bg-slate-800/80 hover:bg-slate-700 border border-white/10 rounded text-[10px] text-slate-400 transition-all"
                  title="Re-open"
                  onclick="event.stopPropagation(); window.municipalController.transitionStatus('${item.uuid}', 'Reported')">
            <i class="fa-solid fa-rotate-left"></i>
          </button>`}
          <button class="py-1 px-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 rounded text-[10px] text-rose-300 transition-all"
                  title="Delete Work Order"
                  onclick="event.stopPropagation(); window.municipalController.deleteWorkOrder('${item.uuid}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        this.openWorkOrderModal(item.uuid);
      });

      col.appendChild(card);
    });

    // Update count chips
    document.querySelectorAll('[data-col-count]').forEach(chip => {
      const colName = chip.getAttribute('data-col-count');
      const count = this.inspections.filter(i => i.status === colName).length;
      chip.textContent = count;
    });
  }

  async transitionStatus(uuid, newStatus) {
    try {
      const res = await fetch(`/api/inspections/${uuid}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Status update failed');

      window.app.showToast(`Updated to stage: ${newStatus}`, 'success');
      this.loadKanbanData();
      if (window.gisMapController) {
        window.gisMapController.loadDefects();
      }
      if (window.app && typeof window.app.loadAnalyticsCharts === 'function') {
        window.app.loadAnalyticsCharts();
      }
    } catch (err) {
      window.app.showToast(`Error: ${err.message}`, 'error');
    }
  }

  async deleteWorkOrder(uuid) {
    if (!confirm('Are you sure you want to delete this municipal work order?')) return;

    try {
      const res = await fetch(`/api/inspections/${uuid}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete work order');

      window.app.showToast('Work order removed from database.', 'info');
      this.loadKanbanData();
      if (window.gisMapController) {
        window.gisMapController.loadDefects();
      }
      if (window.app && typeof window.app.loadAnalyticsCharts === 'function') {
        window.app.loadAnalyticsCharts();
      }
    } catch (err) {
      window.app.showToast(`Error: ${err.message}`, 'error');
    }
  }

  async openWorkOrderModal(uuid) {
    this.currentModalUuid = uuid;
    const modal = document.getElementById('workorder-modal');
    if (!modal) return;

    try {
      const res = await fetch(`/api/inspections/${uuid}`);
      if (!res.ok) throw new Error('Inspection not found');
      const data = await res.json();

      document.getElementById('wo-modal-id').textContent = data.work_order_id;
      document.getElementById('wo-modal-loc').textContent = data.location_name;
      document.getElementById('wo-modal-date').textContent = new Date(data.timestamp).toLocaleString();
      document.getElementById('wo-modal-sev').textContent = data.severity;
      document.getElementById('wo-modal-pci').textContent = `${data.pci_score} / 100 (${data.pci_rating || 'ASTM D6433'})`;
      document.getElementById('wo-modal-cost').textContent = `$${data.estimated_cost_usd} USD / ₹${data.estimated_cost_inr} INR`;
      document.getElementById('wo-modal-tons').textContent = `${data.asphalt_tons} Metric Tons`;
      document.getElementById('wo-modal-action').textContent = data.recommended_action;
      document.getElementById('wo-modal-urgency').textContent = data.urgency_code;
      document.getElementById('wo-modal-status').textContent = data.status;

      modal.classList.remove('hidden');
      modal.classList.add('flex');
    } catch (err) {
      window.app.showToast('Could not load work order details', 'error');
    }
  }

  closeWorkOrderModal() {
    const modal = document.getElementById('workorder-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  downloadCurrentPdf() {
    if (this.currentModalUuid) {
      window.open(`/api/inspections/${this.currentModalUuid}/pdf`, '_blank');
    }
  }

  downloadCurrentCsv() {
    if (this.currentModalUuid) {
      window.open(`/api/inspections/${this.currentModalUuid}/csv`, '_blank');
    }
  }

  exportAllWorkOrdersCsv() {
    if (this.inspections.length === 0) {
      window.app.showToast('No work orders available to export.', 'warning');
      return;
    }

    const headers = ["Work Order ID", "Location", "Latitude", "Longitude", "Severity", "Defects", "PCI Score", "Cost USD", "Cost INR", "Asphalt Tons", "Status", "Timestamp"];
    const rows = this.inspections.map(i => [
      `"${i.work_order_id || ''}"`,
      `"${(i.location_name || '').replace(/"/g, '""')}"`,
      i.latitude,
      i.longitude,
      `"${i.severity}"`,
      i.defect_count,
      i.pci_score,
      i.estimated_cost_usd,
      i.estimated_cost_inr,
      i.asphalt_tons,
      `"${i.status}"`,
      `"${i.timestamp}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RoadVision_Municipal_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.app.showToast('Exported complete municipal work orders CSV!', 'success');
  }
}

window.municipalController = new MunicipalController();
