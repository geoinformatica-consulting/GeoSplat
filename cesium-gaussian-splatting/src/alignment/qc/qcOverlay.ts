// src/alignment/qc/qcOverlay.ts
import { QCController } from './qcController';

export class QCOverlay {
  private controller: QCController;
  private container: HTMLDivElement;
  private visible: boolean = false;

  constructor(controller: QCController) {
    this.controller = controller;
    this.container = this.createOverlay();
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'qc-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      padding: 16px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      min-width: 280px;
      max-width: 350px;
      display: none;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  public toggle(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
    if (this.visible) {
      this.render();
    }
    console.log(`📊 QC Panel: ${this.visible ? 'Shown' : 'Hidden'}`);
  }

  public isVisible(): boolean {
    return this.visible;
  }

  private render(): void {
    const stats = this.controller.getStats();
    const pairs = this.controller.getPairs();
    const mode = this.controller.getMode();

    let html = '<div style="margin-bottom: 12px; border-bottom: 1px solid #444; padding-bottom: 8px;">';
    html += '<strong style="color: #4CAF50;">QC Mode</strong>';
    html += '</div>';

    // Mode status
    html += '<div style="margin-bottom: 12px;">';
    if (mode === 'awaiting_truth') {
      html += '<span style="color: #FFC107;">⏳ Click on GLOBE (truth)</span>';
    } else if (mode === 'awaiting_splat') {
      html += '<span style="color: #FFC107;">⏳ Click on SPLAT</span>';
    } else {
      html += '<span style="color: #888;">Idle</span>';
    }
    html += '</div>';

    // Stats
    html += '<div style="margin-bottom: 12px; border-bottom: 1px solid #444; padding-bottom: 8px;">';
    html += '<strong>Statistics (2D)</strong>';
    html += '</div>';

    if (stats && pairs.length >= 1) {
      html += `<div style="line-height: 1.6;">`;
      html += `Count: <span style="color: #2196F3;">${stats.count}</span><br>`;
      html += `Mean: <span style="color: #2196F3;">${stats.mean2D.toFixed(3)} m</span><br>`;
      html += `RMSE: <span style="color: #2196F3;">${stats.rmse2D.toFixed(3)} m</span><br>`;

      if (stats.count >= 3) {
        html += `P50: <span style="color: #2196F3;">${stats.p50.toFixed(3)} m</span><br>`;
        html += `P95: <span style="color: #FF9800;">${stats.p95.toFixed(3)} m</span><br>`;
        html += `P99: <span style="color: #FF5722;">${stats.p99.toFixed(3)} m</span><br>`;
      }

      html += `Max: <span style="color: #F44336;">${stats.max2D.toFixed(3)} m</span>`;
      html += `</div>`;
    } else {
      html += '<div style="color: #888;">No pairs yet (need ≥1)</div>';
    }

    // Controls
    html += '<div style="margin-top: 16px; border-top: 1px solid #444; padding-top: 12px; font-size: 11px;">';
    html += '<strong style="color: #4CAF50;">Controls</strong><br>';
    html += '<span style="color: #888;">T:</span> Toggle panel<br>';
    html += '<span style="color: #888;">1:</span> Pick truth (globe)<br>';
    html += '<span style="color: #888;">2:</span> Pick splat<br>';
    html += '<span style="color: #888;">E:</span> Export CSV<br>';
    html += '<span style="color: #888;">C:</span> Clear pairs<br>';
    html += '<span style="color: #888;">V:</span> Toggle vectors';
    html += '</div>';

    // Buttons
    html += '<div style="margin-top: 12px; display: flex; gap: 8px;">';
    html += '<button id="qc-export-btn" style="flex: 1; padding: 6px; background: #2196F3; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Export CSV</button>';
    html += '<button id="qc-clear-btn" style="flex: 1; padding: 6px; background: #F44336; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Clear All</button>';
    html += '</div>';

    html += '<div style="margin-top: 8px;">';
    html += `<button id="qc-toggle-vectors-btn" style="width: 100%; padding: 6px; background: ${this.controller.showVectors ? '#4CAF50' : '#666'}; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Vectors: ${this.controller.showVectors ? 'ON' : 'OFF'}</button>`;
    html += '</div>';

    this.container.innerHTML = html;

    // Attach event listeners
    const exportBtn = document.getElementById('qc-export-btn');
    const clearBtn = document.getElementById('qc-clear-btn');
    const toggleVectorsBtn = document.getElementById('qc-toggle-vectors-btn');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.controller.downloadCSV();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all QC pairs?')) {
          this.controller.clearPairs();
        }
      });
    }

    if (toggleVectorsBtn) {
      toggleVectorsBtn.addEventListener('click', () => {
        this.controller.toggleVectors();
      });
    }
  }

  public destroy(): void {
    this.container.remove();
  }
}
