// OneHUD Registration JavaScript

let macAddress = null;
let espLoader = null;
let port = null;

document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
    
    // Get elements
    const emailInput = document.getElementById('email');
    const registerBtn = document.getElementById('registerBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // Check if Web Serial API is supported
    if (!navigator.serial) {
        showStatus('Vui lòng sử dụng trình duyệt Chrome hoặc Edge để đăng ký.', 'error');
        registerBtn.disabled = true;
        return;
    }
    
    // Register button handler
    registerBtn.addEventListener('click', async function() {
        const email = emailInput.value.trim();
        
        if (!validateEmail(email)) {
            showStatus('❌ Vui lòng nhập email hợp lệ', 'error');
            return;
        }
        
        try {
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin btn-icon"></i> Đang xử lý...';
            showStatus('⏳ Đang xác nhận thông tin đăng ký...', 'info');
            
            // Read MAC address in background (user doesn't need to know)
            macAddress = await readMacAddress();
            
            if (!macAddress) {
                throw new Error('Vui lòng kết nối thiết bị vào máy tính và thử lại');
            }
            
            // Send registration
            await sendRegistration(email, macAddress);
            
            showStatus('✅ Đăng ký thành công! Chúng tôi sẽ kiểm tra thanh toán và gửi link firmware cho bạn qua email trong thời gian sớm nhất.', 'success');
            registerBtn.innerHTML = '<i class="fas fa-check btn-icon"></i> Đã gửi đăng ký';
            
            // Disable form after successful registration
            emailInput.disabled = true;
            
        } catch (error) {
            console.error('Registration error:', error);
            showStatus('❌ Lỗi: ' + error.message, 'error');
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<i class="fas fa-check-circle btn-icon"></i> Thông báo đã chuyển tiền';
        }
    });
});

// Read MAC address from ESP device
async function readMacAddress() {
    try {
        // Request serial port
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        
        // Create transport
        const transport = new esptool.Transport(port);
        
        // Create ESPLoader
        espLoader = new esptool.ESPLoader({
            transport: transport,
            baudrate: 115200,
            romBaudrate: 115200,
            terminal: {
                clean: () => {},
                writeLine: (data) => console.log(data),
                write: (data) => console.log(data)
            }
        });
        
        // Connect to chip
        const chip = await espLoader.main();
        console.log('Connected to:', chip);
        
        // Read MAC address
        const mac = await espLoader.readMac(espLoader);
        
        // Disconnect
        await espLoader.hardReset();
        await port.close();
        
        return mac;
        
    } catch (error) {
        if (port) {
            try {
                await port.close();
            } catch (e) {
                console.error('Error closing port:', e);
            }
        }
        throw error;
    }
}

// Send registration to Telegram
async function sendRegistration(email, mac) {
    const botToken = '8464026703:AAFd_w4fL09HFaZ3s_LI81tLJJhyvt0whWs';
    const chatId = '7158639072';
    const message = `🆕 Đăng ký mới!\n\n📧 Email: ${email}\n🔐 MAC: ${mac}\n⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}`;
    
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        if (!response.ok) {
            throw new Error('Không thể gửi thông tin');
        }
        
        const data = await response.json();
        console.log('Registration sent to Telegram:', data);
        return true;
        
    } catch (error) {
        console.error('Telegram API error:', error);
        throw new Error('Không thể kết nối đến server');
    }
}

// Validate email format
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Show status message
function showStatus(message, type = 'info') {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = 'status-message status-' + type;
    statusMessage.style.display = 'block';
}

// Add CSS for status messages and payment section
const style = document.createElement('style');
style.textContent = `
    .register-container {
        display: flex;
        gap: 40px; /* more breathing room */
        width: 100%;
        max-width: 1240px; /* widen overall container */
        margin: 30px auto 0;
        align-items: flex-start;
    }
    
    .register-form {
        flex: 1;
        min-width: 0;
    }
    
    .form-group {
        margin-bottom: 25px;
        text-align: left;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 700;
        color: var(--primary);
        font-size: 16px;
    }
    
    .form-input {
        width: 100%;
        padding: 14px 16px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
        transition: border-color 0.3s ease;
        background: #fff;
        color: #333;
        box-sizing: border-box;
    }
    
    .form-input:focus {
        outline: none;
        border-color: #007bff;
    }
    
    .form-note {
        background: #fff3cd;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 25px;
        border: 1px solid #ffc107;
    }
    
    .form-note p {
        color: #856404;
        font-size: 14px;
        font-weight: 600;
        margin: 0;
    }
    
    .payment-section {
        flex: 0 0 420px; /* wider QR column */
        background: #ffffff;
        padding: 25px;
        border-radius: 12px;
        text-align: center;
        border: 2px solid #ddd;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    
    .payment-section h3 {
        color: var(--primary);
        margin-bottom: 15px;
        font-size: 20px;
        font-weight: 700;
    }
    
    .payment-info {
        color: var(--accent);
        margin-bottom: 20px;
        font-size: 15px;
        font-weight: 600;
    }
    
    .qrcode-container {
        display: flex;
        justify-content: center;
        margin: 20px 0;
    }
    
    .qrcode-image {
        max-width: 360px; /* larger QR image */
        width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        border: 3px solid #f0f0f0;
    }
    
    .status-message {
        margin-top: 20px;
        padding: 14px;
        border-radius: 8px;
        text-align: center;
        font-weight: 500;
        display: none;
        font-size: 15px;
    }
    
    .status-info {
        background: #e7f3ff;
        color: #0066cc;
        border: 2px solid #b3d9ff;
    }
    
    .status-success {
        background: #d4edda;
        color: #155724;
        border: 2px solid #c3e6cb;
    }
    
    .status-error {
        background: #f8d7da;
        color: #721c24;
        border: 2px solid #f5c6cb;
    }
    
    .button-row {
        margin-bottom: 15px;
    }
    
    .btn-secondary {
        background: var(--secondary-color, #6c757d);
    }
    
    .btn-secondary:hover {
        background: var(--secondary-hover, #5a6268);
    }
    
    .fa-spinner {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    /* Keep brand colors in dark mode for visibility */
    @media (prefers-color-scheme: dark) {
        .form-group label,
        .payment-section h3 {
            color: var(--primary) !important;
        }
        .payment-info {
            color: var(--accent) !important;
        }
    }
    
    @media (max-width: 768px) {
        .payment-section {
            padding: 20px 15px;
        }
        
        .qrcode-image {
            max-width: 250px;
        }
    }
`;
document.head.appendChild(style);

