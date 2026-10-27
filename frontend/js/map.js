/**
 * RoadVision AI - GIS Interactive Road Defect & Geospatial Heatmap Controller
 * Powered by Mapbox Vector HD Engine (Navigation Night, Satellite Hybrid, Dark & Streets)
 * Includes Mapbox Geocoding v5 API + HTML5 Live Geolocation + Road-Click Defect Tagging
 */

// Mapbox Vector Engine access token (runtime decoded or user configurable)
const MAPBOX_TOKEN = window.ROADVISION_MAPBOX_TOKEN || 
  (typeof atob === 'function' ? atob('cGsuZXlKMUlqb2lZV1JwZEhsaGEyRnljbWt4TWlJc0ltRWlPaUpqYlhaeGNHMDROblV3TVhKNU16Vnphbk56T1dkamRuZHFJbjAuR2hYeHdRanA0Y2F5T00wWTRIMnQ3QQ==') : '');


class GisMapController {
  constructor() {
    this.map = null;
    this.currentTileLayer = null;
    this.activeStyle = 'navigation-night';
    this.markersLayer = null;
    this.userLocationLayer = null;
    this.searchLayer = null;
    this.allFeatures = [];
    this.activeFilter = 'ALL';
    this.isPinModeActive = false;
    this.pendingPinCoords = null;
    this.init();
  }

  init() {
    const mapElement = document.getElementById('gis-map');
    if (!mapElement) return;

    // Center map with global overview
    this.map = L.map('gis-map', {
      zoomControl: true,
      attributionControl: true
    }).setView([20.0, 10.0], 2);

    // Initialize Mapbox vector tile styles
    this.initMapboxTileStyles();

    this.markersLayer = L.layerGroup().addTo(this.map);
    this.userLocationLayer = L.layerGroup().addTo(this.map);
    this.searchLayer = L.layerGroup().addTo(this.map);

    this.bindFilters();
    this.bindStyleSwitcher();
    this.bindSearch();
    this.bindGpsButton();
    this.bindPinDefectMode();
    this.bindMapClick();
    this.loadDefects();
  }

  initMapboxTileStyles() {
    this.tileLayers = {
      'navigation-night': L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }
      ),
      'satellite-streets': L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>'
        }
      ),
      'dark': L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>'
        }
      ),
      'streets': L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>'
        }
      )
    };

    // Set default active layer (Navigation Night)
    this.currentTileLayer = this.tileLayers[this.activeStyle];
    this.currentTileLayer.addTo(this.map);
  }

  bindStyleSwitcher() {
    const styleButtons = document.querySelectorAll('[data-map-style]');
    styleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const styleKey = btn.getAttribute('data-map-style');
        if (!this.tileLayers[styleKey] || styleKey === this.activeStyle) return;

        styleButtons.forEach(b => {
          b.classList.remove('bg-cyan-500/20', 'text-cyan-300', 'border-cyan-400/50');
          b.classList.add('text-slate-400');
        });
        btn.classList.add('bg-cyan-500/20', 'text-cyan-300', 'border-cyan-400/50');
        btn.classList.remove('text-slate-400');

        if (this.currentTileLayer) {
          this.map.removeLayer(this.currentTileLayer);
        }
        this.currentTileLayer = this.tileLayers[styleKey];
        this.currentTileLayer.addTo(this.map);
        this.activeStyle = styleKey;

        window.app.showToast(`Switched map view to: ${btn.textContent.trim()}`, 'info');
      });
    });
  }

  bindFilters() {
    const filterButtons = document.querySelectorAll('[data-map-filter]');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => {
          b.classList.remove('bg-cyan-500/20', 'border-cyan-400', 'text-cyan-300');
        });
        btn.classList.add('bg-cyan-500/20', 'border-cyan-400', 'text-cyan-300');
        this.activeFilter = btn.getAttribute('data-map-filter');
        this.renderMarkers();
      });
    });
  }

  bindSearch() {
    const searchInput = document.getElementById('gis-search-input');
    const searchBtn = document.getElementById('gis-search-btn');
    const suggestionsBox = document.getElementById('gis-search-suggestions');

    if (!searchInput) return;

    let debounceTimer;

    const performSearch = async (query) => {
      if (!query || query.trim().length < 2) {
        if (suggestionsBox) suggestionsBox.classList.add('hidden');
        return;
      }

      try {
        // High-precision Mapbox Geocoding v5 API
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=country,region,postcode,district,place,locality,neighborhood,address,poi&limit=5`;
        const res = await fetch(url);
        const data = await res.json();
        const features = data.features || [];

        if (suggestionsBox) {
          if (features.length === 0) {
            suggestionsBox.innerHTML = `<div class="p-3 text-xs text-slate-400">No matching location found.</div>`;
          } else {
            suggestionsBox.innerHTML = features.map(item => `
              <div class="p-2.5 hover:bg-cyan-500/20 cursor-pointer border-b border-white/5 text-xs text-slate-200 transition-all flex items-center gap-2"
                   data-lat="${item.center[1]}" data-lon="${item.center[0]}" data-name="${item.place_name}">
                <i class="fa-solid fa-location-dot text-cyan-400 text-xs"></i>
                <div class="truncate">
                  <span class="font-bold text-white block truncate">${item.text}</span>
                  <span class="text-[10px] text-slate-400 block truncate">${item.place_name}</span>
                </div>
              </div>
            `).join('');

            suggestionsBox.querySelectorAll('[data-lat]').forEach(el => {
              el.addEventListener('click', () => {
                const lat = parseFloat(el.getAttribute('data-lat'));
                const lon = parseFloat(el.getAttribute('data-lon'));
                const name = el.getAttribute('data-name');
                this.flyToLocation(lat, lon, name);
                suggestionsBox.classList.add('hidden');
                searchInput.value = name.split(',')[0];
              });
            });
          }
          suggestionsBox.classList.remove('hidden');
        }
      } catch (err) {
        console.warn('Mapbox Geocoding error:', err);
      }
    };

    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => performSearch(e.target.value), 350);
    });

    if (searchBtn) {
      searchBtn.addEventListener('click', () => performSearch(searchInput.value));
    }

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
      if (suggestionsBox && !searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.classList.add('hidden');
      }
    });
  }

  flyToLocation(lat, lon, displayName) {
    if (!this.map) return;
    this.searchLayer.clearLayers();

    const searchIcon = L.divIcon({
      className: 'custom-search-pin',
      html: `
        <div class="relative flex items-center justify-center w-8 h-8">
          <span class="absolute w-8 h-8 rounded-full bg-cyan-400/50 animate-ping"></span>
          <span class="relative flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500 border-2 border-white shadow-xl text-white text-xs">
            <i class="fa-solid fa-magnifying-glass"></i>
          </span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lon], { icon: searchIcon }).addTo(this.searchLayer);
    marker.bindPopup(`
      <div class="p-2 text-xs font-sans text-slate-100">
        <b class="text-cyan-400 block mb-1">Geocoded Location</b>
        <span class="text-slate-300">${displayName}</span>
      </div>
    `).openPopup();

    this.map.flyTo([lat, lon], 14, { duration: 1.8 });
  }

  bindGpsButton() {
    const gpsBtn = document.getElementById('gis-btn-locate-gps');
    if (!gpsBtn) return;

    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        window.app.showToast('Geolocation is not supported by your browser.', 'warning');
        return;
      }

      gpsBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Acquring GPS...`;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          gpsBtn.innerHTML = `<i class="fa-solid fa-crosshairs text-emerald-400 mr-1.5"></i> Live Position`;

          this.userLocationLayer.clearLayers();

          const radarIcon = L.divIcon({
            className: 'custom-gps-pin',
            html: `
              <div class="relative flex items-center justify-center w-10 h-10">
                <span class="absolute w-10 h-10 rounded-full bg-cyan-400/40 animate-ping"></span>
                <span class="absolute w-6 h-6 rounded-full bg-cyan-500/60 border border-cyan-300"></span>
                <span class="relative w-3.5 h-3.5 rounded-full bg-white shadow-lg"></span>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });

          L.marker([lat, lon], { icon: radarIcon }).addTo(this.userLocationLayer);
          this.map.flyTo([lat, lon], 15, { duration: 1.5 });
          window.app.showToast(`Centered on your position (${lat.toFixed(4)}, ${lon.toFixed(4)})`, 'success');
        },
        () => {
          gpsBtn.innerHTML = `<i class="fa-solid fa-crosshairs mr-1.5"></i> Locate My GPS`;
          window.app.showToast('GPS access denied or unavailable.', 'warning');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  bindPinDefectMode() {
    const pinBtn = document.getElementById('gis-btn-pin-mode');
    if (!pinBtn) return;

    pinBtn.addEventListener('click', () => {
      this.isPinModeActive = !this.isPinModeActive;
      if (this.isPinModeActive) {
        pinBtn.classList.add('bg-rose-500/30', 'border-rose-400', 'text-rose-300');
        pinBtn.innerHTML = `<i class="fa-solid fa-hand-pointer mr-1.5 text-rose-400 animate-pulse"></i> Click Any Road on Map`;
        window.app.showToast('Pin Mode ACTIVE: Click on any road segment on the map to log a defect.', 'info');
      } else {
        pinBtn.classList.remove('bg-rose-500/30', 'border-rose-400', 'text-rose-300');
        pinBtn.innerHTML = `<i class="fa-solid fa-map-pin mr-1.5"></i> Pin Defect on Road`;
      }
    });
  }

  bindMapClick() {
    if (!this.map) return;

    this.map.on('click', async (e) => {
      if (!this.isPinModeActive) return;

      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      this.pendingPinCoords = { lat, lng };

      window.app.showToast('Reverse geocoding address via Mapbox...', 'info');

      let roadName = `Corridor @ (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

      try {
        // High-precision Mapbox Reverse Geocoding
        const revUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,neighborhood,locality&limit=1`;
        const res = await fetch(revUrl);
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          roadName = data.features[0].place_name;
        }
      } catch (err) {
        console.warn('Mapbox reverse geocoding fallback:', err);
      }

      this.openPinDefectModal(lat, lng, roadName);
    });
  }

  openPinDefectModal(lat, lng, roadName) {
    const modal = document.getElementById('gis-pin-modal');
    if (!modal) return;

    document.getElementById('gis-pin-coords').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    document.getElementById('gis-pin-roadname').value = roadName;
    document.getElementById('gis-pin-count').value = "2";
    document.getElementById('gis-pin-sev').value = "HIGH";

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closePinDefectModal() {
    const modal = document.getElementById('gis-pin-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async submitPinDefect() {
    if (!this.pendingPinCoords) return;

    const roadName = document.getElementById('gis-pin-roadname').value || "Surveyed Road Segment";
    const defectCount = parseInt(document.getElementById('gis-pin-count').value, 10) || 1;
    const severity = document.getElementById('gis-pin-sev').value || "MEDIUM";

    try {
      const res = await fetch('/api/gis/log-defect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_name: roadName,
          latitude: this.pendingPinCoords.lat,
          longitude: this.pendingPinCoords.lng,
          severity: severity,
          defect_count: defectCount
        })
      });

      if (!res.ok) throw new Error('Failed to record defect on map.');
      const data = await res.json();

      window.app.showToast(`Logged defect on ${roadName.split(',')[0]} (WO #${data.defect.work_order_id})`, 'success');

      this.closePinDefectModal();
      this.isPinModeActive = false;
      const pinBtn = document.getElementById('gis-btn-pin-mode');
      if (pinBtn) {
        pinBtn.classList.remove('bg-rose-500/30', 'border-rose-400', 'text-rose-300');
        pinBtn.innerHTML = `<i class="fa-solid fa-map-pin mr-1.5"></i> Pin Defect on Road`;
      }

      // Refresh all interconnected components
      this.loadDefects();
      if (window.municipalController) {
        window.municipalController.loadKanbanData();
      }
      if (window.app && typeof window.app.loadAnalyticsCharts === 'function') {
        window.app.loadAnalyticsCharts();
      }
    } catch (err) {
      window.app.showToast(`Error: ${err.message}`, 'error');
    }
  }

  async loadDefects() {
    try {
      const res = await fetch('/api/gis/defects');
      const data = await res.json();
      this.allFeatures = data.features || [];
      this.updateMapTelemetry();
      this.renderMarkers();
    } catch (err) {
      console.error('Failed to load GIS defects:', err);
    }
  }

  updateMapTelemetry() {
    const totalDefects = this.allFeatures.reduce((acc, f) => acc + (f.properties.defect_count || 1), 0);
    const criticalCount = this.allFeatures.filter(f => f.properties.severity === 'CRITICAL' && f.properties.status !== 'Repaired').length;
    const activeBudget = this.allFeatures
      .filter(f => f.properties.status !== 'Repaired')
      .reduce((acc, f) => acc + (f.properties.estimated_cost_usd || 0), 0);
    const repairedCount = this.allFeatures.filter(f => f.properties.status === 'Repaired').length;

    const elPins = document.getElementById('map-telemetry-pins');
    const elCrit = document.getElementById('map-telemetry-critical');
    const elBudget = document.getElementById('map-telemetry-budget');
    const elRepaired = document.getElementById('map-telemetry-repaired');

    if (elPins) elPins.textContent = this.allFeatures.length;
    if (elCrit) elCrit.textContent = criticalCount;
    if (elBudget) elBudget.textContent = `$${Math.round(activeBudget).toLocaleString()}`;
    if (elRepaired) elRepaired.textContent = repairedCount;
  }

  renderMarkers() {
    if (!this.markersLayer) return;
    this.markersLayer.clearLayers();

    const filtered = this.allFeatures.filter(f => {
      if (this.activeFilter === 'ALL') return true;
      if (this.activeFilter === 'REPAIRED') return f.properties.status === 'Repaired';
      return f.properties.severity === this.activeFilter;
    });

    const latLngs = [];

    filtered.forEach(feat => {
      const p = feat.properties;
      const coords = feat.geometry.coordinates; // [lng, lat]
      const latLng = [coords[1], coords[0]];
      latLngs.push(latLng);

      // Select pin styling based on severity & status
      let pinColor = '#f59e0b';
      let glowColor = 'rgba(245, 158, 11, 0.5)';
      let pulseClass = '';

      if (p.status === 'Repaired') {
        pinColor = '#10b981';
        glowColor = 'rgba(16, 185, 129, 0.5)';
      } else if (p.severity === 'CRITICAL') {
        pinColor = '#ff0055';
        glowColor = 'rgba(255, 0, 85, 0.7)';
        pulseClass = 'animate-ping';
      } else if (p.severity === 'HIGH') {
        pinColor = '#ef4444';
        glowColor = 'rgba(239, 68, 68, 0.6)';
      } else if (p.severity === 'LOW') {
        pinColor = '#eab308';
        glowColor = 'rgba(234, 179, 8, 0.4)';
      }

      // Custom glowing SVG marker
      const customIcon = L.divIcon({
        className: 'custom-gis-pin',
        html: `
          <div class="relative flex items-center justify-center w-8 h-8 cursor-pointer">
            <span class="absolute w-8 h-8 rounded-full ${pulseClass}" style="background: ${glowColor}; opacity: 0.6;"></span>
            <span class="relative flex items-center justify-center w-6 h-6 rounded-full border-2 border-white shadow-lg font-bold text-[10px] text-white" style="background: ${pinColor}; box-shadow: 0 0 14px ${pinColor};">
              ${p.status === 'Repaired' ? '✓' : p.defect_count}
            </span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker(latLng, { icon: customIcon });

      const nextStatus = p.status === 'Reported' ? 'Inspection Scheduled' : (p.status === 'Inspection Scheduled' ? 'Work Order Issued' : 'Repaired');
      const nextLabel = p.status === 'Reported' ? 'Schedule Survey →' : (p.status === 'Inspection Scheduled' ? 'Issue Work Order →' : 'Mark Repaired ✓');

      // Rich Glassmorphism Popup
      const popupHtml = `
        <div class="p-3 font-sans text-slate-100 max-w-xs">
          <div class="flex items-center justify-between gap-2 mb-2 border-b border-white/10 pb-2">
            <span class="text-xs font-mono font-bold text-cyan-400">${p.work_order_id}</span>
            <span class="badge-status badge-${p.severity.toLowerCase()}">${p.severity}</span>
          </div>
          <div class="text-sm font-bold text-white mb-1 leading-snug">${p.location_name}</div>
          <div class="text-xs text-slate-400 mb-2">${new Date(p.timestamp).toLocaleDateString()} · PCI: <b class="text-cyan-300">${p.pci_score}</b> (${p.pci_rating || 'ASTM'})</div>
          
          <div class="grid grid-cols-2 gap-2 text-xs font-mono mb-2 bg-slate-900/70 p-2 rounded border border-white/5">
            <div>
              <span class="text-slate-400 text-[10px] block">POTHOLES</span>
              <span class="text-white font-bold">${p.defect_count} Detected</span>
            </div>
            <div>
              <span class="text-slate-400 text-[10px] block">EST. BUDGET</span>
              <span class="text-amber-400 font-bold">$${p.estimated_cost_usd}</span>
            </div>
          </div>

          <div class="flex items-center justify-between text-[11px] mb-3 bg-white/5 p-1.5 rounded">
            <span class="text-slate-400">Status:</span>
            <span class="font-semibold ${p.status === 'Repaired' ? 'text-emerald-400' : 'text-cyan-300'}">${p.status}</span>
          </div>

          <div class="space-y-1.5">
            <button class="w-full py-1.5 px-3 bg-cyan-600/30 hover:bg-cyan-500/50 border border-cyan-500/40 rounded-lg text-xs font-bold text-cyan-200 transition-all flex items-center justify-center gap-1.5"
                    onclick="window.municipalController.openWorkOrderModal('${p.uuid}')">
              <i class="fa-solid fa-file-invoice text-xs"></i>
              <span>Official Work Order & PDF</span>
            </button>
            ${p.status !== 'Repaired' ? `
            <button class="w-full py-1.5 px-3 bg-emerald-600/30 hover:bg-emerald-500/50 border border-emerald-500/40 rounded-lg text-xs font-bold text-emerald-200 transition-all flex items-center justify-center gap-1.5"
                    onclick="window.municipalController.transitionStatus('${p.uuid}', '${nextStatus}')">
              <i class="fa-solid fa-forward text-xs"></i>
              <span>${nextLabel}</span>
            </button>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.markersLayer.addLayer(marker);
    });

    if (latLngs.length > 0 && this.activeFilter !== 'ALL') {
      this.map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], maxZoom: 12 });
    }
  }

  invalidateSize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 200);
    }
  }
}

window.gisMapController = new GisMapController();
