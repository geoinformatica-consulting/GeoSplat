export function createInstructionsPopup() {
  // Styles
  const style = document.createElement("style");
  style.textContent = `
    .info-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 1200;
      padding: 6px 10px;
      font: 500 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: rgba(32,32,32,0.75);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      cursor: pointer;
      backdrop-filter: blur(3px);
      pointer-events: auto;
    }
    .info-btn:hover { background: rgba(32,32,32,0.9); }
    .info-btn:active { transform: translateY(1px); }

    .info-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.35);
      z-index: 1199;
      display: none;
    }
    .info-modal {
      position: fixed;
      top: 8%;
      left: 50%;
      transform: translateX(-50%);
      width: min(860px, calc(100vw - 32px));
      max-height: 80vh;
      overflow: auto;
      background: #111;
      color: #eee;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.35);
      padding: 16px 18px 18px 18px;
      z-index: 1201;
      display: none;
    }
    .info-modal h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      letter-spacing: 0.2px;
    }
    .info-modal .muted { color: #bbb; font-size: 12px; margin-bottom: 12px; }

    /* Accordion */
    .info-accordion details {
      background: #151515;
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 8px;
      margin: 10px 0;
      overflow: hidden;
    }
    .info-accordion summary {
      list-style: none;
      cursor: pointer;
      padding: 10px 12px;
      font-size: 13px;
      color: #eee;
      background: #171717;
      user-select: none;
    }
    .info-accordion summary::-webkit-details-marker { display: none; }
    .info-accordion .panel {
      padding: 10px 12px 12px 12px;
      font-size: 12px;
      line-height: 1.45;
      color: #ddd;
    }
    .info-accordion ul {
      margin: 0;
      padding-left: 18px;
    }

    .info-close {
      position: absolute;
      right: 12px;
      top: 10px;
      background: transparent;
      color: #ccc;
      border: 0;
      font-size: 18px;
      cursor: pointer;
    }
    .info-close:hover { color: #fff; }
  `;
  document.head.appendChild(style);

  // Button
  const btn = document.createElement("button");
  btn.className = "info-btn";
  btn.type = "button";
  btn.title = "Show instructions (Shift + /)";
  btn.textContent = "Instructions";
  document.body.appendChild(btn);

  // Backdrop and modal
  const backdrop = document.createElement("div");
  backdrop.className = "info-backdrop";
  document.body.appendChild(backdrop);

  const modal = document.createElement("div");
  modal.className = "info-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Viewer instructions");

  modal.innerHTML = `
    <button class="info-close" aria-label="Close">×</button>
    <h3>Instructions</h3>
    <div class="muted">Press Shift + / to toggle this window.</div>

    <div class="info-accordion">

      <details open>
        <summary>Key navigation</summary>
        <div class="panel">
          <ul>
            <li>Camera
              <ul>
                <li>Home button resets to default view</li>
                <li>F focuses camera on the splat</li>
              </ul>
            </li>
            <li>Splat positioning
              <ul>
                <li>Y or H move latitude, J or G move longitude</li>
                <li>O or L move height</li>
                <li>Q or W yaw, A or S pitch, Z or X roll</li>
                <li>M or N scale up or down</li>
                <li>P print final pose, Shift + S save pose, R reset, Shift + L auto level</li>
              </ul>
            </li>
            <li>Modes
              <ul>
                <li>] toggles Parcel mode and QC mode</li>
                <li>T toggles QC panel</li>
              </ul>
            </li>
            <li>QC actions
              <ul>
                <li>1 pick truth point, 2 pick splat point</li>
                <li>E export CSV when QC panel is visible</li>
                <li>C clear pairs when QC panel is visible</li>
                <li>V toggle vectors when QC panel is visible</li>
              </ul>
            </li>
            <li>GCP validation
              <ul>
                <li>Shift + V load GCP CSV, B pick next GCP</li>
                <li>Shift + E compute errors, Shift + X export CSV</li>
                <li>Ctrl + Shift + C clear all GCP pairs</li>
              </ul>
            </li>
            <li>Viewer settings
              <ul>
                <li>I blank imagery, Shift + I Esri World Imagery, Ctrl + I OpenStreetMap</li>
                <li>D toggle translucent depth picking</li>
                <li>K toggle terrain occlusion of splat</li>
                <li>Shift + O toggle depth test against terrain</li>
              </ul>
            </li>
          </ul>
        </div>
      </details>

      <details>
        <summary>Mouse navigation</summary>
        <div class="panel">
          <ul>
            <li>Left drag rotates the globe or scene</li>
            <li>Right drag pans</li>
            <li>Mouse wheel zooms in or out</li>
            <li>Double click zooms in to cursor location</li>
            <li>Shift + left drag changes tilt more aggressively when supported</li>
          </ul>
        </div>
      </details>

      <details>
        <summary>Touchscreen navigation</summary>
        <div class="panel">
          <ul>
            <li>One finger drag rotates the globe or scene</li>
            <li>Two finger drag pans</li>
            <li>Pinch zooms in or out</li>
            <li>Double tap zooms in to tap location</li>
            <li>Two finger tap zooms out when supported</li>
          </ul>
        </div>
      </details>

    </div>
  `;
  document.body.appendChild(modal);

  // Behavior
  const closeBtn = modal.querySelector<HTMLButtonElement>(".info-close")!;
  const open = () => {
    backdrop.style.display = "block";
    modal.style.display = "block";
    closeBtn.focus();
  };
  const close = () => {
    modal.style.display = "none";
    backdrop.style.display = "none";
    btn.focus();
  };
  const toggle = () => (modal.style.display === "block" ? close() : open());

  // Events
  btn.addEventListener("click", toggle);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "block") { e.preventDefault(); close(); }
    if ((e.key === "?" || (e.key === "/" && e.shiftKey))) { e.preventDefault(); toggle(); }
  });

  return { open, close, toggle, btn, modal };
}
