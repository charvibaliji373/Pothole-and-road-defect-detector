/**
 * RoadVision AI - Detection Studio, Comparison Slider, 3D Flip Cards & Video Inspector
 */

class DetectorController {
  constructor() {
    this.selectedFile = null;
    this.selectedSampleId = null;
    this.currentInspectionUuid = null;
    this.isComparing = false;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSamplePresets();
    this.initComparisonSlider();
  }

  bindEvents() {
    const dropzone = document.getElementById('image-dropzone');
    const fileInput = document.getElementById('image-file-input');
    const confSlider = document.getElementById('conf-slider');
    const confValue = document.getElementById('conf-value');
    const detectBtn = document.getElementById('btn-run-detection');
    const videoFileInput = document.getElementById('video-file-input');
    const detectVideoBtn = document.getElementById('btn-run-video-detection');

    // Confidence slider update
    if (confSlider && confValue) {
      confSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        confValue.textContent = `${Math.round(val * 100)}%`;
      });
    }

    // Dropzone drag & drop
    if (dropzone && fileInput) {
      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.add('border-cyan-400', 'bg-cyan-950/20');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.remove('border-cyan-400', 'bg-cyan-950/20');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFileSelect(e.dataTransfer.files[0]);
        }
      });

      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFileSelect(e.target.files[0]);
        }
      });
    }

    // Run Detection Button
    if (detectBtn) {
      detectBtn.addEventListener('click', () => this.runDetection());
    }

    // Video Detection Button
    if (detectVideoBtn && videoFileInput) {
      detectVideoBtn.addEventListener('click', () => {
        if (videoFileInput.files && videoFileInput.files.length > 0) {
          this.runVideoDetection(videoFileInput.files[0]);
        } else {
          window.app.showToast('Please select a video file first', 'warning');
        }
      });
    }

    // Export PDF / CSV
    const btnPdf = document.getElementById('btn-download-pdf');
    const btnCsv = document.getElementById('btn-download-csv');

    if (btnPdf) {
      btnPdf.addEventListener('click', () => {
        if (this.currentInspectionUuid) {
          window.open(`/api/inspections/${this.currentInspectionUuid}/pdf`, '_blank');
        }
      });
    }

    if (btnCsv) {
      btnCsv.addEventListener('click', () => {
        if (this.currentInspectionUuid) {
          window.open(`/api/inspections/${this.currentInspectionUuid}/csv`, '_blank');
        }
      });
    }
  }

  async loadSamplePresets() {
    const container = document.getElementById('sample-presets-container');
    if (!container) return;

    try {
      const res = await fetch('/api/samples');
      const data = await res.json();
      if (!data.samples || data.samples.length === 0) return;

      container.innerHTML = '';
      data.samples.forEach((sample, idx) => {
        const thumb = document.createElement('div');
        thumb.className = 'relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 hover:border-cyan-400/80 transition-all hover:scale-105';
        thumb.innerHTML = `
          <img src="${sample.url}" class="w-24 h-16 object-cover rounded-xl" alt="Road Sample ${idx + 1}" />
          <div class="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <span class="text-[10px] font-bold text-cyan-300">PRESET ${idx + 1}</span>
          </div>
        `;
        thumb.addEventListener('click', () => {
          this.selectSample(sample.id, sample.url, thumb);
        });
        container.appendChild(thumb);
      });

      // Auto-select first sample as initial preview
      if (data.samples.length > 0) {
        const firstThumb = container.children[0];
        this.selectSample(data.samples[0].id, data.samples[0].url, firstThumb);
      }
    } catch (err) {
      console.error('Failed to load sample presets:', err);
    }
  }

  selectSample(sampleId, url, thumbElement) {
    this.selectedSampleId = sampleId;
    this.selectedFile = null;

    // Highlight thumbnail
    document.querySelectorAll('#sample-presets-container > div').forEach(el => {
      el.classList.remove('ring-2', 'ring-cyan-400');
    });
    if (thumbElement) thumbElement.classList.add('ring-2', 'ring-cyan-400');

    // Show in preview
    const previewContainer = document.getElementById('preview-box');
    const previewImg = document.getElementById('preview-image');
    const emptyState = document.getElementById('upload-empty-state');
    const filenameLabel = document.getElementById('selected-filename');

    if (previewImg) previewImg.src = url;
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (filenameLabel) filenameLabel.textContent = `Selected Preset: ${sampleId.substring(0, 16)}...`;

    // Clear previous results display
    document.getElementById('results-section')?.classList.add('hidden');
  }

  handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
      window.app.showToast('Please select a valid road image file (JPG, PNG, WEBP)', 'error');
      return;
    }

    this.selectedFile = file;
    this.selectedSampleId = null;

    // Deselect sample presets
    document.querySelectorAll('#sample-presets-container > div').forEach(el => {
      el.classList.remove('ring-2', 'ring-cyan-400');
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewContainer = document.getElementById('preview-box');
      const previewImg = document.getElementById('preview-image');
      const emptyState = document.getElementById('upload-empty-state');
      const filenameLabel = document.getElementById('selected-filename');

      if (previewImg) previewImg.src = e.target.result;
      if (previewContainer) previewContainer.classList.remove('hidden');
      if (emptyState) emptyState.classList.add('hidden');
      if (filenameLabel) filenameLabel.textContent = `Uploaded File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      document.getElementById('results-section')?.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }

  async compressImage(file, maxDimension = 1024, quality = 0.85) {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) {
        return resolve(file);
      }
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  async runDetection() {
    if (!this.selectedFile && !this.selectedSampleId) {
      window.app.showToast('Please upload a road image or select a preset sample first', 'warning');
      return;
    }

    const radarLoader = document.getElementById('radar-loader');
    const detectBtn = document.getElementById('btn-run-detection');
    const resultsSection = document.getElementById('results-section');

    if (radarLoader) radarLoader.classList.remove('hidden');
    if (detectBtn) {
      detectBtn.disabled = true;
      detectBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Analyzing Road Surface...`;
    }

    const confSlider = document.getElementById('conf-slider');
    const confidence = confSlider ? parseFloat(confSlider.value) : 0.25;

    const formData = new FormData();
    formData.append('confidence', confidence);
    formData.append('location_name', 'Highway Corridor Sector 4');
    formData.append('latitude', 40.7128);
    formData.append('longitude', -74.0060);

    if (this.selectedFile) {
      // Compress client-side so 10MB phone uploads turn into 120KB instant uploads
      const optimizedFile = await this.compressImage(this.selectedFile, 1024, 0.85);
      formData.append('file', optimizedFile);
    } else if (this.selectedSampleId) {
      formData.append('sample_id', this.selectedSampleId);
    }

    try {
      const res = await fetch('/api/detect/image', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error(`Detection request failed: ${res.statusText}`);

      const data = await res.json();
      this.displayResults(data);
      window.app.showToast(`Detection complete! Found ${data.metrics.defect_count} defect(s)`, 'success');
    } catch (err) {
      console.error('Detection error:', err);
      window.app.showToast(`Detection failed: ${err.message}`, 'error');
    } finally {
      if (radarLoader) radarLoader.classList.add('hidden');
      if (detectBtn) {
        detectBtn.disabled = false;
        detectBtn.innerHTML = `<i class="fa-solid fa-bolt mr-2 text-cyan-300"></i> Run Road Damage Detection`;
      }
    }
  }

  displayResults(data) {
    this.currentInspectionUuid = data.inspection_uuid;

    const resultsSection = document.getElementById('results-section');
    if (resultsSection) resultsSection.classList.remove('hidden');

    // Update Comparison Images
    const origImg = document.getElementById('comp-orig-img');
    const annotImg = document.getElementById('comp-annot-img');

    if (origImg) origImg.src = data.original_image_base64;
    if (annotImg) annotImg.src = data.annotated_image_base64;

    // Reset slider to 50%
    this.setComparisonPosition(50);

    // Update Summary Metrics
    const m = data.metrics;
    document.getElementById('metric-defect-count').textContent = m.defect_count;
    document.getElementById('metric-coverage-pct').textContent = `${m.coverage_percent}%`;
    document.getElementById('metric-pci-score').textContent = `${m.pci_score} / 100`;
    document.getElementById('metric-asphalt-tons').textContent = `${m.estimated_asphalt_tons} T`;
    document.getElementById('metric-cost-usd').textContent = `$${m.estimated_cost_usd.toLocaleString()}`;
    document.getElementById('metric-cost-inr').textContent = `₹${m.estimated_cost_inr.toLocaleString()}`;
    document.getElementById('metric-speed-advisory').textContent = `≤ ${m.speed_advisory_mph} mph`;
    document.getElementById('metric-hazard-index').textContent = `${m.hazard_index} / 100`;

    // Severity Badge
    const sevBadge = document.getElementById('metric-severity-badge');
    if (sevBadge) {
      sevBadge.textContent = m.severity;
      sevBadge.className = `badge-status badge-${m.severity.toLowerCase()}`;
    }

    // Recommendation Banner
    document.getElementById('recommendation-action').textContent = m.recommended_action;
    document.getElementById('recommendation-urgency').textContent = m.urgency_code;

    // Render 3D Flip Cards for Defects
    this.renderDefectFlipCards(data.detections, data.crops);

    // Scroll smoothly to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Refresh 3D tilt controller
    if (window.tiltController) {
      window.tiltController.refresh();
    }
  }

  renderDefectFlipCards(detections, crops) {
    const container = document.getElementById('defect-cards-container');
    if (!container) return;

    if (!detections || detections.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-8 text-center glass-panel">
          <i class="fa-solid fa-circle-check text-4xl text-emerald-400 mb-3"></i>
          <h4 class="text-lg font-bold text-slate-100">Zero Critical Defects Detected</h4>
          <p class="text-sm text-slate-400">Road surface within this visual horizon meets satisfactory safety standards.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    detections.forEach((det, idx) => {
      const cropObj = crops.find(c => c.id === det.id) || crops[idx];
      const cropSrc = cropObj ? cropObj.crop_base64 : '';
      const sev = det.severity || 'MEDIUM';
      const sevClass = `badge-${sev.toLowerCase()}`;

      const card = document.createElement('div');
      card.className = 'flip-card';
      card.id = `defect-card-${idx}`;

      card.innerHTML = `
        <div class="flip-card-inner">
          <!-- CARD FRONT: Defect Telemetry -->
          <div class="flip-card-front p-5 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-mono font-bold text-cyan-400 tracking-wider">DEFECT #${idx + 1}</span>
                <div class="flex items-center gap-2">
                  <span class="badge-status ${sevClass}">${sev}</span>
                  <span class="flip-hint-pill"><i class="fa-solid fa-arrows-rotate"></i> Flip ↻</span>
                </div>
              </div>

              <!-- Defect Snapshot Thumbnail -->
              <div class="relative w-full h-36 bg-slate-900 rounded-lg overflow-hidden border border-white/10 mb-4 group cursor-zoom-in"
                   onclick="window.detectorController.openCropModal('${cropSrc}', ${idx + 1}, '${sev}', ${det.confidence})">
                ${cropSrc ? `<img src="${cropSrc}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" alt="Defect Crop" />` : `<div class="w-full h-full flex items-center justify-center text-slate-600 font-mono text-xs">Crop Preview</div>`}
                <div class="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span class="text-xs text-white bg-slate-900/80 px-2.5 py-1 rounded-full"><i class="fa-solid fa-magnifying-glass-plus mr-1"></i> Zoom Crop</span>
                </div>
              </div>

              <!-- Telemetry Stats -->
              <div class="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                <div class="bg-slate-900/60 p-2 rounded border border-white/5">
                  <span class="text-slate-400 block text-[10px]">CONFIDENCE</span>
                  <span class="text-cyan-300 font-bold text-sm">${det.confidence}%</span>
                </div>
                <div class="bg-slate-900/60 p-2 rounded border border-white/5">
                  <span class="text-slate-400 block text-[10px]">EST. AREA</span>
                  <span class="text-amber-300 font-bold text-sm">${det.estimated_area_m2 || 0.18} m²</span>
                </div>
              </div>

              <div class="text-[11px] text-slate-400 space-y-1 mb-2">
                <div>BBox: <span class="font-mono text-slate-300">[${det.bbox.map(n => Math.round(n)).join(', ')}]</span></div>
                <div>Visual Impact: <span class="text-slate-200 font-semibold">${det.coverage_percent || 3.2}% of lane</span></div>
              </div>
            </div>

            <!-- Flip Trigger Action Indicator (Click Anywhere Active) -->
            <div class="flip-card-action flip-card-action-front">
              <span>Inspect Engineering Specs</span>
              <i class="fa-solid fa-rotate-right text-cyan-400"></i>
            </div>
          </div>

          <!-- CARD BACK: Civil Engineering Repair Specification -->
          <div class="flip-card-back p-5 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <span class="text-xs font-mono text-cyan-400 font-bold">ASTM D6433 SPEC</span>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-500/30">REPAIR PROFILE</span>
                  <span class="flip-hint-pill flipped"><i class="fa-solid fa-arrows-rotate"></i> Flip Back ↻</span>
                </div>
              </div>

              <div class="space-y-3 text-xs mb-4">
                <div>
                  <span class="text-slate-400 block text-[11px]">Recommended Method</span>
                  <span class="text-slate-100 font-semibold text-xs leading-snug">
                    ${sev === 'CRITICAL' ? 'Full-Depth Sawcut & Hot Mix Reclamation' : sev === 'HIGH' ? 'Milled Inlay Patch + Tack Coat' : 'Throw-and-Roll Polymer Cold Patch'}
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div class="bg-slate-900/80 p-2 rounded border border-white/5">
                    <span class="text-slate-400 block text-[10px]">ASPHALT REQUIRED</span>
                    <span class="text-emerald-400 font-bold font-mono text-sm">${det.asphalt_required_kg || 45} kg</span>
                  </div>
                  <div class="bg-slate-900/80 p-2 rounded border border-white/5">
                    <span class="text-slate-400 block text-[10px]">EXCAVATION DEPTH</span>
                    <span class="text-cyan-300 font-bold font-mono text-sm">65 - 80 mm</span>
                  </div>
                </div>

                <div class="bg-slate-900/80 p-2.5 rounded border border-white/5">
                  <div class="flex justify-between items-center mb-1">
                    <span class="text-slate-400 text-[10px]">EST. REPAIR COST</span>
                    <span class="text-amber-400 font-bold font-mono text-sm">
                      $${Math.round((det.asphalt_required_kg || 45) * 1.8 + 65)} / ₹${Math.round(((det.asphalt_required_kg || 45) * 1.8 + 65) * 86.5)}
                    </span>
                  </div>
                  <span class="text-[10px] text-slate-500 block">Includes bitumen binder, aggregate & roller pass</span>
                </div>
              </div>
            </div>

            <!-- Flip Back Action Indicator -->
            <div class="flip-card-action flip-card-action-back">
              <i class="fa-solid fa-arrow-left text-slate-400"></i>
              <span>Back to Defect Overview</span>
            </div>
          </div>
        </div>
      `;

      container.appendChild(card);
    });
  }

  flipCard(cardId, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const card = document.getElementById(cardId);
    if (card) {
      card.classList.toggle('is-flipped');
    }
  }

  openCropModal(imgSrc, id, sev, conf) {
    const modal = document.getElementById('crop-modal');
    const modalImg = document.getElementById('crop-modal-image');
    const modalTitle = document.getElementById('crop-modal-title');
    const modalMeta = document.getElementById('crop-modal-meta');

    if (!modal || !modalImg) return;

    modalImg.src = imgSrc;
    if (modalTitle) modalTitle.textContent = `High-Resolution Defect Inspection Crop #${id}`;
    if (modalMeta) modalMeta.textContent = `Classification: Pothole | Confidence: ${conf}% | ASTM Severity: ${sev}`;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeCropModal() {
    const modal = document.getElementById('crop-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  initComparisonSlider() {
    const container = document.getElementById('comparison-box');
    const handle = document.getElementById('comparison-handle');
    if (!container || !handle) return;

    let isDragging = false;

    const onMove = (e) => {
      if (!isDragging) return;
      const rect = container.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const offsetX = clientX - rect.left;
      let percentage = (offsetX / rect.width) * 100;
      percentage = Math.max(0, Math.min(100, percentage));
      this.setComparisonPosition(percentage);
    };

    const stopDrag = () => { isDragging = false; };

    handle.addEventListener('mousedown', () => { isDragging = true; });
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('mousemove', onMove);

    handle.addEventListener('touchstart', () => { isDragging = true; }, { passive: true });
    window.addEventListener('touchend', stopDrag);
    window.addEventListener('touchmove', onMove, { passive: true });
  }

  setComparisonPosition(percent) {
    const overlay = document.getElementById('comparison-overlay');
    const handle = document.getElementById('comparison-handle');
    if (overlay) overlay.style.width = `${percent}%`;
    if (handle) handle.style.left = `${percent}%`;
  }

  async runVideoDetection(file) {
    const loader = document.getElementById('video-radar-loader');
    const resultsContainer = document.getElementById('video-results-container');
    const btn = document.getElementById('btn-run-video-detection');

    if (loader) loader.classList.remove('hidden');
    if (btn) btn.disabled = true;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('confidence', 0.25);

    try {
      const res = await fetch('/api/detect/video', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error(`Video processing failed: ${res.statusText}`);

      const data = await res.json();
      this.displayVideoResults(data);
      window.app.showToast(`Video processed! Found ${data.unique_defects_identified} unique defect instances.`, 'success');
    } catch (err) {
      console.error('Video error:', err);
      window.app.showToast(`Video processing failed: ${err.message}`, 'error');
    } finally {
      if (loader) loader.classList.add('hidden');
      if (btn) btn.disabled = false;
    }
  }

  displayVideoResults(data) {
    const container = document.getElementById('video-results-container');
    if (!container) return;
    container.classList.remove('hidden');

    document.getElementById('video-duration').textContent = `${data.duration_seconds}s`;
    document.getElementById('video-analyzed-frames').textContent = data.analyzed_frames;
    document.getElementById('video-unique-defects').textContent = data.unique_defects_identified;
    document.getElementById('video-overall-sev').textContent = data.overall_severity;

    // Render Keyframes
    const keyframesContainer = document.getElementById('video-keyframes');
    if (keyframesContainer && data.keyframe_snapshots) {
      keyframesContainer.innerHTML = '';
      data.keyframe_snapshots.forEach((snap, idx) => {
        const item = document.createElement('div');
        item.className = 'rounded-xl overflow-hidden border border-white/10 bg-slate-900/60 p-2';
        item.innerHTML = `
          <img src="${snap.image_base64}" class="w-full h-32 object-cover rounded-lg mb-2" alt="Keyframe ${idx}" />
          <div class="flex justify-between items-center text-xs font-mono">
            <span class="text-cyan-400">@ ${snap.timestamp}</span>
            <span class="badge-status badge-${snap.severity.toLowerCase()}">${snap.severity}</span>
          </div>
        `;
        keyframesContainer.appendChild(item);
      });
    }

    container.scrollIntoView({ behavior: 'smooth' });
  }
}

window.detectorController = new DetectorController();
