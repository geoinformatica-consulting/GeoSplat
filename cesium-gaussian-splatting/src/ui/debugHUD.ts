/**
 * Debug HUD for showing render/picking status
 */

export class DebugHUD {
  private hudElement: HTMLDivElement;
  private indicators: Map<string, HTMLSpanElement> = new Map();

  constructor() {
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'debug-hud';
    this.hudElement.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 10px;
      background: rgba(0, 0, 0, 0.75);
      color: #0f0;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      padding: 8px 12px;
      border-radius: 4px;
      z-index: 9999;
      pointer-events: none;
      line-height: 1.6;
    `;

    document.body.appendChild(this.hudElement);
  }

  /**
   * Set an indicator value
   */
  public set(key: string, value: string | boolean, color?: string): void {
    let indicator = this.indicators.get(key);

    if (!indicator) {
      indicator = document.createElement('span');
      indicator.style.display = 'block';
      this.indicators.set(key, indicator);
      this.hudElement.appendChild(indicator);
    }

    const displayValue = typeof value === 'boolean' ? (value ? 'ON' : 'OFF') : value;
    const displayColor = color || (value === true || value === 'ON' ? '#0f0' : '#f00');

    indicator.innerHTML = `<span style="color: #888">${key}:</span> <span style="color: ${displayColor}; font-weight: bold">${displayValue}</span>`;
  }

  /**
   * Remove an indicator
   */
  public remove(key: string): void {
    const indicator = this.indicators.get(key);
    if (indicator) {
      this.hudElement.removeChild(indicator);
      this.indicators.delete(key);
    }
  }

  /**
   * Clear all indicators
   */
  public clear(): void {
    this.indicators.forEach((indicator) => {
      this.hudElement.removeChild(indicator);
    });
    this.indicators.clear();
  }

  /**
   * Show or hide the HUD
   */
  public setVisible(visible: boolean): void {
    this.hudElement.style.display = visible ? 'block' : 'none';
  }

  /**
   * Toggle visibility
   */
  public toggleVisible(): void {
    const isVisible = this.hudElement.style.display !== 'none';
    this.setVisible(!isVisible);
  }
}
