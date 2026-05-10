// --- VISUAL UI EDITOR ---
class FleetVehicleCardEditor extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("keydown", (e) => e.stopPropagation());
    this.addEventListener("keyup", (e) => e.stopPropagation());
    this.addEventListener("keypress", (e) => e.stopPropagation());
  }

  setConfig(config) {
    this._config = config;
    if (!this.rendered) { this.render(); this.rendered = true; }
  }

  set hass(hass) {
    this._hass = hass;
    this.querySelectorAll("ha-entity-picker").forEach((picker) => picker.hass = hass);
  }

  configChanged(newConfig) {
    const event = new Event("config-changed", { bubbles: true, composed: true });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }

  render() {
    if (!this._config) return;
    
    this.innerHTML = `
      <style>
        .card-config { display: flex; flex-direction: column; gap: 24px; padding-bottom: 16px; }
        .section { background: var(--secondary-background-color); padding: 16px; border-radius: 8px; border: 1px solid var(--divider-color); }
        .section-header { margin-top: 0; margin-bottom: 12px; color: var(--primary-text-color); font-size: 16px; font-weight: 500; border-bottom: 1px solid var(--divider-color); padding-bottom: 8px; }
        .help-text { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 16px; display: block; line-height: 1.4; }
        .entity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .full-width { grid-column: 1 / -1; }
      </style>

      <div class="card-config">
        <div class="section">
          <h3 class="section-header">1. Card Title</h3>
          <span class="help-text">What do you want to call this vehicle?</span>
          <ha-textfield label="Vehicle Name" value="${this._config.name || ''}" class="config-text" data-key="name"></ha-textfield>
        </div>

        <div class="section">
          <h3 class="section-header">2. Auto-Detect Maintenance</h3>
          <span class="help-text">We automatically sort sensors with a "miles_remaining" attribute. Keyword filter (e.g., 'jeep') isolates cars.</span>
          <div class="entity-grid">
            <ha-textfield label="Keyword Filter (Optional)" value="${this._config.maint_filter || ''}" class="config-text full-width" data-key="maint_filter"></ha-textfield>
            <ha-textfield label="Max Items to Show" type="number" value="${this._config.max_maint || 3}" class="config-text full-width" data-key="max_maint"></ha-textfield>
          </div>
        </div>

        <div class="section">
          <h3 class="section-header">3. Live OBD2 Data</h3>
          <span class="help-text">Select your OBD2 sensors. Leave blank to hide.</span>
          <div class="entity-grid">
            <ha-entity-picker label="Fuel Level (%)" value="${this._config.fuel_entity || ''}" class="config-entity full-width" data-key="fuel_entity"></ha-entity-picker>
            <ha-entity-picker label="Weekly Miles" value="${this._config.weekly_miles_entity || ''}" class="config-entity" data-key="weekly_miles_entity"></ha-entity-picker>
            <ha-entity-picker label="7-Day MPG" value="${this._config.mpg_entity || ''}" class="config-entity" data-key="mpg_entity"></ha-entity-picker>
            <ha-entity-picker label="Battery Voltage" value="${this._config.battery_entity || ''}" class="config-entity" data-key="battery_entity"></ha-entity-picker>
            <ha-entity-picker label="Coolant Temp" value="${this._config.coolant_entity || ''}" class="config-entity" data-key="coolant_entity"></ha-entity-picker>
            <ha-entity-picker label="DTC Codes / Engine" value="${this._config.dtc_entity || ''}" class="config-entity" data-key="dtc_entity"></ha-entity-picker>
            
            <h4 class="full-width" style="margin: 12px 0 0 0; font-size: 14px; color: var(--secondary-text-color);">Tire Pressures</h4>
            <ha-entity-picker label="Front Left" value="${this._config.tire_fl || ''}" class="config-entity" data-key="tire_fl"></ha-entity-picker>
            <ha-entity-picker label="Front Right" value="${this._config.tire_fr || ''}" class="config-entity" data-key="tire_fr"></ha-entity-picker>
            <ha-entity-picker label="Rear Left" value="${this._config.tire_rl || ''}" class="config-entity" data-key="tire_rl"></ha-entity-picker>
            <ha-entity-picker label="Rear Right" value="${this._config.tire_rr || ''}" class="config-entity" data-key="tire_rr"></ha-entity-picker>
          </div>
        </div>
      </div>
    `;

    if (this._hass) this.querySelectorAll("ha-entity-picker").forEach(p => p.hass = this._hass);
    this.querySelectorAll('.config-text').forEach(el => el.addEventListener('input', e => this.configChanged({ ...this._config, [e.target.dataset.key]: e.target.value })));
    this.querySelectorAll('.config-entity').forEach(el => el.addEventListener('value-changed', e => this.configChanged({ ...this._config, [e.target.dataset.key]: e.detail.value })));
  }
}
customElements.define("fleet-vehicle-card-editor", FleetVehicleCardEditor);


// --- THE DASHBOARD CARD ---
class FleetVehicleCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this.expanded = false; }
  static getConfigElement() { return document.createElement("fleet-vehicle-card-editor"); }
  static getStubConfig() { return { name: "My Vehicle", max_maint: 3 }; }
  setConfig(config) { if (!config.name) throw new Error("Please define a vehicle name"); this._config = config; }
  set hass(hass) { this._hass = hass; this.render(); }
  toggleExpand() { this.expanded = !this.expanded; this.render(); }

  getState(entityId) { return entityId && this._hass.states[entityId] ? this._hass.states[entityId].state : null; }

  render() {
    if (!this._config || !this._hass) return;

    let maintEntities = Object.values(this._hass.states).filter(s => s.attributes.miles_remaining !== undefined);
    
    if (this._config.maint_filter) {
      const filterStr = this._config.maint_filter.toLowerCase();
      maintEntities = maintEntities.filter(s => s.entity_id.toLowerCase().includes(filterStr) || (s.attributes.friendly_name && s.attributes.friendly_name.toLowerCase().includes(filterStr)));
    }

    const statusWeight = { "Past Due": 0, "Coming Up": 1, "All Good": 2 };
    maintEntities.sort((a, b) => {
      const weightA = statusWeight[a.state] ?? 3;
      const weightB = statusWeight[b.state] ?? 3;
      if (weightA !== weightB) return weightA - weightB;
      return (a.attributes.miles_remaining || 0) - (b.attributes.miles_remaining || 0);
    });

    const maxToShow = parseInt(this._config.max_maint) || 3;
    const visibleMaint = maintEntities.slice(0, maxToShow);

    const isAlert = visibleMaint.some(e => e.state === "Past Due");
    const isWarning = visibleMaint.some(e => e.state === "Coming Up");
    const headerColor = isAlert ? "var(--error-color)" : (isWarning ? "var(--warning-color)" : "var(--info-color)");

    const obd2 = {
        fuel: this.getState(this._config.fuel_entity),
        miles: this.getState(this._config.weekly_miles_entity),
        mpg: parseFloat(this.getState(this._config.mpg_entity)),
        batt: this.getState(this._config.battery_entity),
        temp: this.getState(this._config.coolant_entity),
        dtc: this.getState(this._config.dtc_entity)
    };

    const tires = {
        fl: this.getState(this._config.tire_fl),
        fr: this.getState(this._config.tire_fr),
        rl: this.getState(this._config.tire_rl),
        rr: this.getState(this._config.tire_rr)
    };

    const fuelVal = parseFloat(obd2.fuel);
    const fuelColor = fuelVal <= 20 ? 'var(--error-color)' : 'var(--info-color)';

    let mpgColor = 'var(--primary-text-color)';
    if (obd2.mpg >= 25) mpgColor = 'var(--success-color)';
    else if (obd2.mpg >= 15) mpgColor = 'var(--warning-color)';
    else if (obd2.mpg > 0) mpgColor = 'var(--error-color)';

    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding: 16px; transition: all 0.3s ease; }
        .header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .icon-bg { background: ${headerColor}20; color: ${headerColor}; padding: 12px; border-radius: 50%; display: flex; }
        .title { font-size: 18px; font-weight: bold; color: var(--primary-text-color); }
        .subtitle { font-size: 13px; color: var(--secondary-text-color); margin-top: 4px; display: flex; align-items: center; gap: 6px; }
        
        .expanded-content { display: ${this.expanded ? 'block' : 'none'}; margin-top: 20px; border-top: 1px solid var(--divider-color); padding-top: 16px; }
        .section-title { font-size: 12px; color: var(--secondary-text-color); text-transform: uppercase; font-weight: bold; margin-bottom: 12px; letter-spacing: 0.5px; }
        
        .fuel-container { background: var(--secondary-background-color); padding: 16px; border-radius: 8px; margin-bottom: 12px; }
        .fuel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .fuel-label-group { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--primary-text-color); }
        .fuel-val { font-size: 16px; font-weight: bold; }
        .fuel-track { background: var(--divider-color); height: 10px; border-radius: 5px; overflow: hidden; width: 100%; }
        .fuel-fill { height: 100%; transition: width 0.5s ease-in-out; border-radius: 5px; }

        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 20px; }
        .data-item { background: var(--secondary-background-color); padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px; }
        .data-item ha-icon { color: var(--primary-color); opacity: 0.8; }
        .data-val { font-weight: 600; font-size: 15px; }
        .data-label { font-size: 11px; color: var(--secondary-text-color); text-transform: uppercase; margin-top: 2px;}

        .tire-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; background: var(--secondary-background-color); padding: 12px; border-radius: 8px; text-align: center; }
        .tire-item { padding: 8px; }
        .tire-val { font-size: 18px; font-weight: bold; color: var(--primary-text-color); }
        .tire-label { font-size: 10px; color: var(--secondary-text-color); text-transform: uppercase; }

        .maint-list { display: flex; flex-direction: column; gap: 8px; }
        .maint-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--secondary-background-color); border-radius: 8px; }
        
        /* NEW STYLES FOR CLEAN NAME & CATEGORY BADGE */
        .maint-name-group { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .maint-name { font-weight: 600; font-size: 14px; color: var(--primary-text-color); }
        .maint-category { font-size: 10px; font-weight: bold; background: var(--divider-color); color: var(--secondary-text-color); padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;}
        .maint-sub { font-size: 12px; color: var(--secondary-text-color); }
        
        .status-badge { font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-Good { background: var(--success-color)20; color: var(--success-color); }
        .status-Up { background: var(--warning-color)20; color: var(--warning-color); }
        .status-Past { background: var(--error-color)20; color: var(--error-color); }
      </style>

      <ha-card>
        <div class="header" id="toggle-btn">
          <div class="header-left">
            <div class="icon-bg"><ha-icon icon="mdi:car"></ha-icon></div>
            <div>
              <div class="title">${this._config.name}</div>
              <div class="subtitle">
                ${obd2.fuel ? `<ha-icon icon="mdi:gas-station" style="--mdc-icon-size: 14px;"></ha-icon> ${obd2.fuel}% &nbsp;•&nbsp; ` : ''} 
                ${isAlert ? '⚠️ Maintenance Overdue' : (isWarning ? '⚠️ Maintenance Soon' : '✅ All Good')}
              </div>
            </div>
          </div>
          <ha-icon icon="${this.expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'}"></ha-icon>
        </div>

        <div class="expanded-content">
          ${(obd2.fuel || obd2.miles || !isNaN(obd2.mpg) || obd2.batt || obd2.temp || obd2.dtc) ? `<div class="section-title">Live Diagnostics</div>` : ''}
          
          ${obd2.fuel ? `
            <div class="fuel-container">
              <div class="fuel-header">
                <div class="fuel-label-group"><ha-icon icon="mdi:gas-station" style="color: ${fuelColor}"></ha-icon> Fuel Level</div>
                <div class="fuel-val" style="color: ${fuelColor}">${obd2.fuel}%</div>
              </div>
              <div class="fuel-track">
                <div class="fuel-fill" style="width: ${obd2.fuel}%; background-color: ${fuelColor};"></div>
              </div>
            </div>
          ` : ''}

          <div class="grid">
            ${!isNaN(obd2.mpg) ? `<div class="data-item"><ha-icon icon="mdi:leaf"></ha-icon><div><div class="data-val" style="color: ${mpgColor}">${obd2.mpg} MPG</div><div class="data-label">7-Day Avg</div></div></div>` : ''}
            ${obd2.batt ? `<div class="data-item"><ha-icon icon="mdi:car-battery"></ha-icon><div><div class="data-val" style="color: var(--primary-text-color);">${obd2.batt}V</div><div class="data-label">Battery</div></div></div>` : ''}
            ${obd2.miles ? `<div class="data-item"><ha-icon icon="mdi:map-marker-distance"></ha-icon><div><div class="data-val" style="color: var(--primary-text-color);">${obd2.miles} mi</div><div class="data-label">Weekly Miles</div></div></div>` : ''}
            ${obd2.temp ? `<div class="data-item"><ha-icon icon="mdi:coolant-temperature"></ha-icon><div><div class="data-val" style="color: var(--primary-text-color);">${obd2.temp}°</div><div class="data-label">Coolant</div></div></div>` : ''}
            ${obd2.dtc ? `<div class="data-item"><ha-icon icon="mdi:engine-outline"></ha-icon><div><div class="data-val" style="color: var(--primary-text-color);">${obd2.dtc}</div><div class="data-label">DTC Codes</div></div></div>` : ''}
          </div>

          ${(tires.fl || tires.fr || tires.rl || tires.rr) ? `
          <div class="section-title">Tire Pressure</div>
          <div class="tire-grid">
            <div class="tire-item"><div class="tire-val">${tires.fl || '-'}</div><div class="tire-label">Front Left</div></div>
            <div class="tire-item"><div class="tire-val">${tires.fr || '-'}</div><div class="tire-label">Front Right</div></div>
            <div class="tire-item"><div class="tire-val">${tires.rl || '-'}</div><div class="tire-label">Rear Left</div></div>
            <div class="tire-item"><div class="tire-val">${tires.rr || '-'}</div><div class="tire-label">Rear Right</div></div>
          </div>
          ` : ''}

          ${visibleMaint.length > 0 ? `<div class="section-title">Maintenance Schedule</div><div class="maint-list">` : ''}
            
            ${visibleMaint.map(entity => {
              const state = entity.state;
              
              // --- UPDATED: PULLING THE PURE DATA FROM ATTRIBUTES! ---
              const cleanName = entity.attributes.service_name || entity.attributes.friendly_name || 'Unknown Service';
              const category = entity.attributes.category || 'Maintenance';
              const dueDate = entity.attributes.due_date ? ` • Due ~${entity.attributes.due_date}` : '';
              const milesLeft = entity.attributes.miles_remaining || 0;
              
              const statusClass = state ? (state.includes('Past') ? 'Past' : (state.includes('Up') ? 'Up' : 'Good')) : 'Good';
              
              return `
              <div class="maint-item">
                <div>
                  <div class="maint-name-group">
                    <div class="maint-name">${cleanName}</div>
                    <div class="maint-category">${category}</div>
                  </div>
                  <div class="maint-sub">${milesLeft.toLocaleString()} miles remaining${dueDate}</div>
                </div>
                <div class="status-badge status-${statusClass}">${state}</div>
              </div>`;
            }).join('')}
            
          ${visibleMaint.length > 0 ? `</div>` : ''}
          
        </div>
      </ha-card>
    `;

    this.shadowRoot.getElementById('toggle-btn').addEventListener('click', () => this.toggleExpand());
  }
}

customElements.define("fleet-vehicle-card", FleetVehicleCard);

window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === "fleet-vehicle-card")) {
  window.customCards.push({
    type: "fleet-vehicle-card",
    name: "Fleet Vehicle Card",
    preview: true,
    description: "A cohesive, collapsible card for your fleet maintenance."
  });
}