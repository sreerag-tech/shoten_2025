// Checkout Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize checkout functionality
    setupCheckoutActions();
    createCheckoutParticles();
    
    // Show any messages
    if (typeof checkoutMessage !== 'undefined' && checkoutMessage) {
        Swal.fire({
            title: checkoutMessage.type === "success" ? "✅ Success!" : "❌ Error",
            text: checkoutMessage.text,
            icon: checkoutMessage.type,
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    }
});

function setupCheckoutActions() {
    // Address selection
    document.querySelectorAll('.address-card').forEach(card => {
        card.addEventListener('click', function() {
            const radio = this.querySelector('.address-radio');
            if (radio) {
                radio.checked = true;
                updateAddressSelection();
            }
        });
    });
    
    // Address radio buttons
    document.querySelectorAll('.address-radio').forEach(radio => {
        radio.addEventListener('change', updateAddressSelection);
    });
    
    // Payment method selection
    document.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', function() {
            const radio = this.querySelector('.payment-radio');
            if (radio && !radio.disabled) {
                radio.checked = true;
                updatePaymentSelection();
            }
        });
    });
    
    // Payment radio buttons
    document.querySelectorAll('.payment-radio').forEach(radio => {
        radio.addEventListener('change', updatePaymentSelection);
    });
    
    // Add new address button
    document.querySelector('.add-address-btn')?.addEventListener('click', function() {
        showAddAddressModal();
    });
    
    // Set default address buttons
    document.querySelectorAll('.set-default-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const addressId = this.getAttribute('data-address-id');
            setDefaultAddress(addressId);
        });
    });
    
    // Place order button
    document.querySelector('.place-order-btn')?.addEventListener('click', function() {
        placeOrder();
    });
}

function updateAddressSelection() {
    // Remove selection styling from all cards
    document.querySelectorAll('.address-card').forEach(card => {
        card.classList.remove('border-[#00ffff]', 'bg-[#00ffff]/5');
        card.classList.add('border-gray-700');
    });
    
    // Add selection styling to selected card
    const selectedRadio = document.querySelector('.address-radio:checked');
    if (selectedRadio) {
        const selectedCard = selectedRadio.closest('.address-card');
        selectedCard.classList.remove('border-gray-700');
        selectedCard.classList.add('border-[#00ffff]', 'bg-[#00ffff]/5');
    }
}

function updatePaymentSelection() {
    // Remove selection styling from all payment options
    document.querySelectorAll('.payment-option').forEach(option => {
        option.classList.remove('border-[#00ffff]', 'bg-[#00ffff]/5');
        option.classList.add('border-gray-700');
    });
    
    // Add selection styling to selected option
    const selectedRadio = document.querySelector('.payment-radio:checked');
    if (selectedRadio) {
        const selectedOption = selectedRadio.closest('.payment-option');
        selectedOption.classList.remove('border-gray-700');
        selectedOption.classList.add('border-[#00ffff]', 'bg-[#00ffff]/5');
    }
}

function showAddAddressModal() {
    Swal.fire({
        title: '📍 Add New Address',
        html: `
            <div class="text-left space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Full Name *</label>
                    <input type="text" id="name" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                           placeholder="Enter full name" required>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Address Type *</label>
                    <select id="addressType" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600" required>
                        <option value="">Select address type</option>
                        <option value="Home">Home</option>
                        <option value="Work">Work</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Address *</label>
                    <textarea id="address" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                              placeholder="Enter full address" rows="2" required></textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Locality *</label>
                    <input type="text" id="locality" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                           placeholder="Enter locality/area" required>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Landmark</label>
                    <input type="text" id="landMark" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                           placeholder="Near landmark (optional)">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">City *</label>
                        <input type="text" id="city" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                               placeholder="Enter city" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">State *</label>
                        <input type="text" id="state" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                               placeholder="Enter state" required>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Pincode *</label>
                        <input type="text" id="pincode" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                               placeholder="6-digit pincode" maxlength="6" pattern="[0-9]{6}" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Phone *</label>
                        <input type="tel" id="phone" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                               placeholder="10-digit phone" maxlength="10" pattern="[0-9]{10}" required>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#00ffff',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Add Address',
        cancelButtonText: 'Cancel',
        background: '#1f2937',
        color: '#ffffff',
        width: '600px',
        preConfirm: () => {
            const name = document.getElementById('name').value.trim();
            const addressType = document.getElementById('addressType').value;
            const address = document.getElementById('address').value.trim();
            const locality = document.getElementById('locality').value.trim();
            const landMark = document.getElementById('landMark').value.trim();
            const city = document.getElementById('city').value.trim();
            const state = document.getElementById('state').value.trim();
            const pincode = document.getElementById('pincode').value.trim();
            const phone = document.getElementById('phone').value.trim();

            // Validation
            if (!name || !address || !locality || !city || !state || !pincode || !phone) {
                Swal.showValidationMessage('Please fill all required fields');
                return false;
            }

            if (!/^[0-9]{6}$/.test(pincode)) {
                Swal.showValidationMessage('Please enter a valid 6-digit pincode');
                return false;
            }

            if (!/^[0-9]{10}$/.test(phone)) {
                Swal.showValidationMessage('Please enter a valid 10-digit phone number');
                return false;
            }

            return { name, addressType, address, locality, landMark, city, state, pincode, phone };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            addNewAddress(result.value);
        }
    });
}

function createCheckoutParticles() {
    const particlesContainer = document.getElementById('checkout-particles');
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

function validateCheckout() {
    // Check if address is selected
    const selectedAddress = document.querySelector('.address-radio:checked');
    if (!selectedAddress) {
        Swal.fire({
            title: '❌ Address Required',
            text: 'Please select a delivery address to continue.',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
        return false;
    }
    
    // Check if payment method is selected
    const selectedPayment = document.querySelector('.payment-radio:checked');
    if (!selectedPayment) {
        Swal.fire({
            title: '❌ Payment Method Required',
            text: 'Please select a payment method to continue.',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
        return false;
    }
    
    return true;
}

// Initialize address selection on page load
document.addEventListener('DOMContentLoaded', function() {
    updateAddressSelection();
    updatePaymentSelection();
});
