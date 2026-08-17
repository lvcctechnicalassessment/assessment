/**
 * Notification panel for teachers
 */

const Notifications = {
  renderPanel(container, notifications) {
    if (!container) return;

    // Keep only recent high-priority ones visible
    const highPriority = ['paste', 'copy', 'tabswitch', 'blur', 'close', 'rightclick', 'drop'];

    if (!notifications || notifications.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Deduplicate recent identical
    const seen = new Set();
    const filtered = notifications.filter(n => {
      const key = `${n.studentEmail}-${n.type}-${n.details}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 15);

    container.innerHTML = `
      <div class="notifications-panel">
        <div class="notifications-header">
          <span>🔔 Integrity Alerts (${filtered.length})</span>
          <button class="btn btn-sm btn-ghost" onclick="this.closest('.notifications-panel').remove()">✕</button>
        </div>
        <div class="notifications-list">
          ${filtered.map(n => {
            const isHigh = highPriority.includes(n.type);
            const time = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString() : '';
            return `
              <div class="notification-item ${isHigh ? 'high' : ''}">
                <strong>${escapeHtml(n.studentName || n.studentEmail)}</strong>
                <div>${escapeHtml(n.type.toUpperCase())}: ${escapeHtml(n.details || '')}</div>
                <div class="time">${time}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }
};

window.Notifications = Notifications;
