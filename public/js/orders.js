// Orders Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize order management
    setupOrderSearch();
    setupOrderFilters();
    setupOrderActions();
    createOrderParticles();
    
    // Show any messages
    if (typeof orderMessage !== 'undefined' && orderMessage) {
        Swal.fire({
            title: orderMessage.type === "success" ? "✅ Success!" : "❌ Error",
            text: orderMessage.text,
            icon: orderMessage.type,
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    }
});

function setupOrderSearch() {
    const searchInput = document.getElementById('order-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            filterOrders();
        });
    }
}

function setupOrderFilters() {
    const statusFilter = document.getElementById('status-filter');
    const dateFilter = document.getElementById('date-filter');
    
    if (statusFilter) {
        statusFilter.addEventListener('change', filterOrders);
    }
    
    if (dateFilter) {
        dateFilter.addEventListener('change', filterOrders);
    }
}

function filterOrders() {
    const searchTerm = document.getElementById('order-search').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    const dateFilter = document.getElementById('date-filter').value;
    
    const orderCards = document.querySelectorAll('.order-card');
    
    orderCards.forEach(card => {
        const orderNumber = card.getAttribute('data-order-number')?.toLowerCase() || '';
        const status = card.getAttribute('data-status');

        let showCard = true;

        // Search filter
        if (searchTerm && !orderNumber.includes(searchTerm)) {
            showCard = false;
        }
        
        // Status filter
        if (statusFilter && status !== statusFilter) {
            showCard = false;
        }
        
        // Date filter (simplified - you can enhance this)
        if (dateFilter) {
            // Add date filtering logic here
        }
        
        card.style.display = showCard ? 'block' : 'none';
    });
}

function setupOrderActions() {
    // View Order Details
    document.querySelectorAll('.view-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            window.location.href = `/orders/${orderId}`;
        });
    });
    
    // Download Invoice
    document.querySelectorAll('.download-invoice-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            downloadInvoice(orderId);
        });
    });
    
    // Cancel Order
    document.querySelectorAll('.cancel-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            showCancelOrderModal(orderId);
        });
    });
    
    // Cancel Item
    document.querySelectorAll('.cancel-item-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const itemIndex = this.getAttribute('data-item-index');
            showCancelItemModal(orderId, itemIndex);
        });
    });
    
    // Return Order
    document.querySelectorAll('.return-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            showReturnOrderModal(orderId);
        });
    });
    
    // Return Item
    document.querySelectorAll('.return-item-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const itemIndex = this.getAttribute('data-item-index');
            showReturnItemModal(orderId, itemIndex);
        });
    });
}

function createOrderParticles() {
    const particlesContainer = document.getElementById('orders-particles');
    if (!particlesContainer) return;

    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 8 + 's';
        particle.style.animationDuration = (Math.random() * 4 + 8) + 's';
        particlesContainer.appendChild(particle);
    }
}
