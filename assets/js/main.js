// OneHUD Firmware Flasher JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
    
    // Convert Unix timestamp to readable format
    const buildTimestampElement = document.getElementById('buildTimestamp');
    if (buildTimestampElement) {
        const unixTimestamp = buildTimestampElement.textContent;
        if (unixTimestamp && !isNaN(unixTimestamp)) {
            const date = new Date(parseInt(unixTimestamp) * 1000);
            const formattedDate = date.toLocaleString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            buildTimestampElement.textContent = formattedDate;
        }
    }
    
    // Add click handlers for device cards
    const deviceCards = document.querySelectorAll('.device-card');
    deviceCards.forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.classList.contains('btn')) {
                const link = this.querySelector('.btn');
                if (link) {
                    link.click();
                }
            }
        });
    });
});

// Add some interactive features
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'error' ? '#dc3545' : '#28a745'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
