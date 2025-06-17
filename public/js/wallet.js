// Wallet Management JavaScript

// Show Add Money Modal
function showAddMoneyModal() {
    document.getElementById('addMoneyModal').classList.remove('hidden');
    document.getElementById('addAmount').focus();
}

// Close Add Money Modal
function closeAddMoneyModal() {
    document.getElementById('addMoneyModal').classList.add('hidden');
    document.getElementById('addMoneyForm').reset();
}

// Set Quick Amount
function setAmount(amount) {
    document.getElementById('addAmount').value = amount;
}

// Add Money Form Handler
document.getElementById('addMoneyForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const amount = document.getElementById('addAmount').value;
    
    // Validate amount
    if (!amount || amount <= 0) {
        Swal.fire({
            title: '❌ Invalid Amount',
            text: 'Please enter a valid amount',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
        return;
    }
    
    if (amount > 50000) {
        Swal.fire({
            title: '❌ Amount Too High',
            text: 'Maximum amount allowed is ₹50,000',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
        return;
    }
    
    // Show loading
    Swal.fire({
        title: 'Processing...',
        text: 'Adding money to your wallet',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#ffffff',
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    // Add money to wallet
    fetch('/wallet/add-money', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amount })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                title: '✅ Money Added!',
                text: data.message,
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            }).then(() => {
                closeAddMoneyModal();
                location.reload(); // Refresh to show updated balance
            });
        } else {
            Swal.fire({
                title: '❌ Error',
                text: data.message,
                icon: 'error',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            });
        }
    })
    .catch(error => {
        Swal.fire({
            title: '❌ Error',
            text: 'Failed to add money to wallet',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
});

// Refresh Transactions
function refreshTransactions() {
    Swal.fire({
        title: 'Refreshing...',
        text: 'Loading latest transactions',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#ffffff',
        timer: 1000,
        didOpen: () => {
            Swal.showLoading();
        }
    }).then(() => {
        location.reload();
    });
}

// Get Wallet Balance (for other pages)
function getWalletBalance() {
    return fetch('/wallet/balance')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data.balance;
            }
            return 0;
        })
        .catch(error => {
            return 0;
        });
}

// Update Wallet Balance Display (for header)
function updateWalletBalance() {
    getWalletBalance().then(balance => {
        const walletElements = document.querySelectorAll('.wallet-balance');
        walletElements.forEach(element => {
            element.textContent = `₹${balance.toLocaleString()}`;
        });
    });
}

// Close modal on outside click
document.getElementById('addMoneyModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeAddMoneyModal();
    }
});

// Close modal on escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAddMoneyModal();
    }
});

// Initialize wallet balance update on page load
document.addEventListener('DOMContentLoaded', function() {
    updateWalletBalance();
});
