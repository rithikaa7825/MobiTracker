document.addEventListener('DOMContentLoaded', () => {
    // ---- Authentication Logic ----
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const btnLogout = document.getElementById('btn-logout');

    function checkAuth() {
        if (AuthDB.isLoggedIn()) {
            loginScreen.style.display = 'none';
            mainApp.style.display = 'flex';
            refreshDashboard();
            refreshTicketsView();
        } else {
            loginScreen.style.display = 'flex';
            mainApp.style.display = 'none';
        }
    }

    // Initial check
    checkAuth();

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (AuthDB.login(email, password)) {
            loginError.style.display = 'none';
            checkAuth(); // Switch to main app
        } else {
            loginError.style.display = 'block';
        }
    });

    btnLogout.addEventListener('click', () => {
        AuthDB.logout();
        loginForm.reset();
        checkAuth(); // Switch back to login
    });

    // ---- Settings Logic ----
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const btnSettings = document.getElementById('btn-settings');
    const closeSettingsBtn = document.querySelector('.close-settings');
    const settingsError = document.getElementById('settings-error');

    btnSettings.addEventListener('click', () => {
        settingsModal.classList.add('show');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('show');
        settingsForm.reset();
        settingsError.style.display = 'none';
    });

    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const oldPass = document.getElementById('setting-old-pass').value;
        const newEmail = document.getElementById('setting-new-email').value;
        const newPass = document.getElementById('setting-new-pass').value;

        const success = AuthDB.updateCredentials(oldPass, newEmail, newPass);
        if (success) {
            settingsModal.classList.remove('show');
            settingsForm.reset();
            settingsError.style.display = 'none';
            // Auto logout to test new credentials
            AuthDB.logout();
            loginForm.reset();
            checkAuth();
            alert("Credentials updated successfully. Please log in with your new details.");
        } else {
            settingsError.style.display = 'block';
        }
    });

    // ---- Image Handling Logic ----
    const imageInput = document.getElementById('mobile-image-input');
    const imagePreview = document.getElementById('mobile-image-preview');
    const imagePreviewImg = imagePreview.querySelector('img');
    const imageBase64Hidden = document.getElementById('device-image-base64');

    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    // Resize image to max 800px width/height for LocalStorage optimization
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
                    imageBase64Hidden.value = dataUrl;
                    imagePreviewImg.src = dataUrl;
                    imagePreview.classList.add('has-image');
                    imagePreview.querySelector('p').style.display = 'none';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // ---- View Switching Logic ----
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update Active Nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Update View
            const targetId = item.getAttribute('data-target');
            views.forEach(v => v.classList.remove('active-view'));
            document.getElementById(targetId).classList.add('active-view');
            
            // Update Title
            pageTitle.textContent = item.textContent;

            // Trigger data refresh if needed
            if (targetId === 'dashboard-view') refreshDashboard();
            if (targetId === 'tickets-view') refreshTicketsView();
        });
    });

    // ---- Form Submission Logic ----
    const newServiceForm = document.getElementById('new-service-form');
    newServiceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(newServiceForm);
        const ticketData = {
            customer: {
                name: formData.get('customerName'),
                contact: formData.get('customerContact')
            },
            device: {
                brand: formData.get('deviceModel'),
                imei: formData.get('imeiNumber'),
                screenCondition: formData.get('screenCondition'),
                powerStatus: formData.get('powerStatus')
            },
            problem: {
                type: formData.get('problemType'),
                description: formData.get('problemDescription')
            },
            expectedDate: formData.get('expectedDate'),
            deviceImage: formData.get('deviceImageBase64')
        };

        TicketDB.addTicket(ticketData);
        alert('Service Ticket created successfully!');
        newServiceForm.reset();
        
        // Reset image preview
        imagePreview.classList.remove('has-image');
        imagePreviewImg.src = '';
        imagePreview.querySelector('p').style.display = 'block';
        imageBase64Hidden.value = '';
        
        // Auto-switch to tickets view
        navItems[2].click(); 
    });

    // ---- Render Functions ----
    function getStatusBadge(status) {
        let cls = '';
        if (status === 'Pending') cls = 'status-pending';
        if (status === 'In Progress') cls = 'status-progress';
        if (status === 'Completed') cls = 'status-completed';
        return `<span class="status-badge ${cls}">${status}</span>`;
    }

    function refreshDashboard() {
        const tickets = TicketDB.getTickets();
        
        // Metrics Calculate
        const activeT = tickets.filter(t => t.status !== 'Completed').length;
        const today = new Date().toISOString().split('T')[0];
        const completedToday = tickets.filter(t => t.status === 'Completed' && t.dates.actualDelivery === today).length;
        
        let pendingIncome = 0;
        tickets.forEach(t => {
            if (t.payment.status === 'Unpaid' && t.payment.totalAmount > 0) {
                pendingIncome += t.payment.totalAmount;
            }
        });

        document.getElementById('metric-active').textContent = activeT;
        document.getElementById('metric-completed').textContent = completedToday;
        document.getElementById('metric-income').textContent = `₹${pendingIncome}`;

        // Recent Tickets Table
        const tbody = document.querySelector('#dashboard-recent-table tbody');
        tbody.innerHTML = '';
        const recent = [...tickets].reverse().slice(0, 5); // Last 5
        
        recent.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${t.serviceId}</strong></td>
                <td>${t.customer.name}</td>
                <td>${t.device.brand}</td>
                <td>${getStatusBadge(t.status)}</td>
                <td>${t.dates.received}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function refreshTicketsView() {
        const tickets = TicketDB.getTickets();
        const tbody = document.querySelector('#all-tickets-table tbody');
        tbody.innerHTML = '';
        
        // Render in reverse chronological order
        const sorted = [...tickets].reverse();
        sorted.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${t.serviceId}</strong></td>
                <td>${t.customer.name}<br><small style="color:var(--text-secondary)">${t.customer.contact}</small></td>
                <td>${t.device.brand}</td>
                <td>${t.problem.type}</td>
                <td>${t.dates.received}</td>
                <td>${t.dates.actualDelivery || '---'}</td>
                <td>${getStatusBadge(t.status)}</td>
                <td><button class="btn btn-sm view-ticket-btn" data-id="${t.serviceId}">Update</button></td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners to update buttons
        document.querySelectorAll('.view-ticket-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openTicketModal(e.target.getAttribute('data-id'));
            });
        });
    }

    // ---- Modal Logic ----
    const modal = document.getElementById('ticket-modal');
    const closeBtn = document.querySelector('.close-modal');

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });

    function openTicketModal(serviceId) {
        const t = TicketDB.getTicket(serviceId);
        if (!t) return;

        // Image Display
        const imgContainer = document.getElementById('m-image-container');
        const imgEl = document.getElementById('m-device-image');
        if (t.deviceImage) {
            imgEl.src = t.deviceImage;
            imgContainer.style.display = 'block';
        } else {
            imgContainer.style.display = 'none';
        }

        // Timeline populate
        document.getElementById('m-date-received').textContent = t.dates.received;
        document.getElementById('m-date-expected').textContent = t.dates.expectedDelivery;
        document.getElementById('m-date-actual').textContent = t.dates.actualDelivery || 'Not Delivered Yet';

        // Populate Info Headers
        document.getElementById('modal-service-id').textContent = t.serviceId;
        document.getElementById('m-customer').textContent = t.customer.name;
        document.getElementById('m-contact').textContent = t.customer.contact;
        document.getElementById('m-device').textContent = t.device.brand;
        document.getElementById('m-problem').textContent = `${t.problem.type} - ${t.problem.description}`;

        // Populate Form Data
        document.getElementById('update-ticket-id').value = t.serviceId;
        document.getElementById('update-status').value = t.status;
        document.getElementById('update-payment-status').value = t.payment.status;
        document.getElementById('update-work').value = t.repair.workCompleted;
        document.getElementById('update-spares').value = t.repair.sparePartsUsed;
        document.getElementById('update-service-charge').value = t.payment.serviceCharge;
        document.getElementById('update-spares-cost').value = t.payment.sparePartsCost;
        document.getElementById('update-total').textContent = t.payment.totalAmount;

        modal.classList.add('show');
    }

    // Modal Calculation Listeners
    const scInput = document.getElementById('update-service-charge');
    const spcInput = document.getElementById('update-spares-cost');
    const totalSpan = document.getElementById('update-total');

    function updateTotal() {
        const val = (parseFloat(scInput.value) || 0) + (parseFloat(spcInput.value) || 0);
        totalSpan.textContent = val;
    }

    scInput.addEventListener('input', updateTotal);
    spcInput.addEventListener('input', updateTotal);

    // Modal Update Form Submission
    const updateForm = document.getElementById('update-ticket-form');
    updateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const serviceId = document.getElementById('update-ticket-id').value;
        const updateData = {
            status: document.getElementById('update-status').value,
            repair: {
                workCompleted: document.getElementById('update-work').value,
                sparePartsUsed: document.getElementById('update-spares').value
            },
            payment: {
                status: document.getElementById('update-payment-status').value,
                serviceCharge: parseFloat(document.getElementById('update-service-charge').value) || 0,
                sparePartsCost: parseFloat(document.getElementById('update-spares-cost').value) || 0,
                totalAmount: parseFloat(document.getElementById('update-total').textContent) || 0
            }
        };

        TicketDB.updateTicket(serviceId, updateData);
        modal.classList.remove('show');
        
        // Refresh views
        refreshDashboard();
        refreshTicketsView();
    });

    // ---- Main Initialization ----
    // Removed direct load inside DOMContentLoaded as it is now handled by checkAuth()

    // ---- AI Scanner Logic ----
    const scanBtn = document.getElementById('scan-device-btn');
    const scannerModal = document.getElementById('scanner-modal');
    const closeScannerBtn = document.querySelector('.close-scanner');
    const video = document.getElementById('scanner-video');
    const canvas = document.getElementById('scanner-canvas');
    const statusText = document.getElementById('scanner-status');
    const captureBtn = document.getElementById('capture-device-btn');
    const targetInput = document.getElementById('device-model-input');

    let model = null;
    let stream = null;
    let isDetecting = false;
    let animationId = null;
    let scanAttempt = 0;

    // AI Safe Mode & Background Loading
    async function loadScannerModel() {
        if (model) return true;
        try {
            statusText.textContent = "Checking System Compatibility...";
            
            // Try to initialize GPU (WebGL) with a timeout
            const backendPromise = tf.setBackend('webgl').then(() => tf.ready());
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("GPU Timeout")), 3000)
            );

            try {
                await Promise.race([backendPromise, timeoutPromise]);
                console.log("Using GPU Acceleration");
            } catch (e) {
                console.warn("GPU failed or timed out, switching to Safe Mode (CPU)");
                await tf.setBackend('cpu');
                await tf.ready();
            }

            statusText.textContent = "Downloading AI Model... (approx. 25MB)";
            model = await cocoSsd.load();
            statusText.textContent = "AI Ready to Scan!";
            captureBtn.textContent = "Hold device to camera...";
            return true;
        } catch (err) {
            console.error("AI Error:", err);
            statusText.textContent = "AI Model Failed. Please check internet connection.";
            return false;
        }
    }

    // Start loading the model in the background as soon as app starts
    loadScannerModel();

    // Start Webcam
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            video.srcObject = stream;
            
            return new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    // Match canvas to video dimensions
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    resolve();
                };
            });
        } catch (err) {
            console.error("Webcam error:", err);
            let errMsg = err.message || err.name || "Unknown Error";
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                errMsg = "Not supported in this browser. Please use http://localhost:8000";
            }
            statusText.innerHTML = `Camera Error: ${errMsg}<br><small>Tip: Check if camera is connected or blocked in browser settings.</small>`;
            return false;
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        isDetecting = false;
    }

    // Detection Loop
    async function detectFrame() {
        if (!isDetecting || !model) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        try {
            scanAttempt++;
            // Lower detection threshold and check for multiple common mobile-like objects
            const predictions = await model.detect(video);
            
            let phoneDetected = false;

            predictions.forEach(p => {
                // If the AI is 40% sure it's a phone, remote, or electronic device, we accept it
                const isMobileClass = ['cell phone', 'remote', 'laptop', 'mouse'].includes(p.class);
                
                if (isMobileClass && p.score > 0.4) {
                    phoneDetected = true;
                    // Draw Box
                    ctx.strokeStyle = '#38BDF8';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]);
                    
                    // Draw Label
                    ctx.fillStyle = '#38BDF8';
                    ctx.fillRect(p.bbox[0], p.bbox[1] - 30, 160, 30);
                    ctx.fillStyle = '#000';
                    ctx.font = 'bold 16px Inter sans-serif';
                    ctx.fillText(`${p.class.toUpperCase()} ${Math.round(p.score * 100)}%`, p.bbox[0] + 5, p.bbox[1] - 10);
                }
            });

            if (phoneDetected) {
                statusText.textContent = "✨ Mobile Device Detected!";
                statusText.style.color = "var(--success)";
                captureBtn.disabled = false;
                captureBtn.textContent = "Capture & Auto-Fill";
            } else {
                statusText.textContent = `Scanning... (Attempt #${scanAttempt})`;
                statusText.style.color = "var(--accent-primary)";
                captureBtn.disabled = true;
                captureBtn.textContent = "Hold device closer to camera...";
            }
        } catch (e) {
            console.error("Detection Error:", e);
        }

        // Continue loop with a slight delay to prevent CPU choking
        if (isDetecting) {
            setTimeout(() => {
                animationId = requestAnimationFrame(detectFrame);
            }, 300); // Scan 3 times per second
        }
    }

    // Open Modal and Start
    scanBtn.addEventListener('click', async () => {
        scannerModal.classList.add('show');
        
        const camStarted = await startCamera();
        if (camStarted) {
            const modelLoaded = await loadScannerModel();
            if (modelLoaded) {
                isDetecting = true;
                detectFrame();
            }
        }
    });

    function closeScanner() {
        scannerModal.classList.remove('show');
        stopCamera();
    }

    closeScannerBtn.addEventListener('click', closeScanner);
    
    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === scannerModal) {
            closeScanner();
        }
    });

    // Capture & Auto-fill
    captureBtn.addEventListener('click', () => {
        targetInput.value = "Smart Phone (Detected)";
        closeScanner();
        
        // Flash input to show it was populated
        targetInput.style.backgroundColor = 'rgba(56, 189, 248, 0.3)';
        setTimeout(() => {
            targetInput.style.backgroundColor = '';
        }, 500);
    });
});
