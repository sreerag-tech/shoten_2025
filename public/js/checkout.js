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
    
    // Edit address buttons
    document.querySelectorAll('.edit-address-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const addressId = this.getAttribute('data-address-id');
            editAddress(addressId);
        });
    });

    // Set default address buttons
    document.querySelectorAll('.set-default-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const addressId = this.getAttribute('data-address-id');
            setDefaultAddress(addressId);
        });
    });
    
    // Place order button event listener moved to checkout-actions.js
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

function editAddress(addressId) {
    // Find the address card by looking for the button with the matching data-address-id
    const editButton = document.querySelector(`.edit-address-btn[data-address-id="${addressId}"]`);
    if (!editButton) {
        Swal.fire({
            title: '❌ Error',
            text: 'Address not found',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
        return;
    }

    // Get the parent address card
    const addressCard = editButton.closest('.address-card');
    if (!addressCard) {
        Swal.fire({
            title: '❌ Error',
            text: 'Address card not found',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
        return;
    }

    try {
        // Extract address data from the checkout page structure
        const nameElement = addressCard.querySelector('h3');
        const addressLines = addressCard.querySelectorAll('p');

        // Parse name (remove "(Default)" if present)
        const nameText = nameElement.textContent.trim();
        const name = nameText.replace('(Default)', '').trim();

        // Extract address details from the paragraphs
        let address = '';
        let locality = '';
        let city = '';
        let state = '';
        let pincode = '';
        let landMark = '';
        let phone = '';

        // First paragraph: address and landmark
        if (addressLines.length >= 1) {
            const addressText = addressLines[0].textContent.trim();
            if (addressText.includes(', Near ')) {
                const parts = addressText.split(', Near ');
                address = parts[0];
                landMark = parts[1];
            } else {
                address = addressText;
            }
        }

        // Second paragraph: locality, city, state - pincode
        if (addressLines.length >= 2) {
            const locationText = addressLines[1].textContent.trim();
            const parts = locationText.split(' - ');
            if (parts.length >= 2) {
                pincode = parts[1];
                const locationParts = parts[0].split(', ');
                if (locationParts.length >= 3) {
                    locality = locationParts[0];
                    city = locationParts[1];
                    state = locationParts[2];
                }
            }
        }

        // Third paragraph: phone
        if (addressLines.length >= 3) {
            const phoneText = addressLines[2].textContent.trim();
            phone = phoneText.replace(/[^\d]/g, ''); // Extract only digits
        }

        const addressData = {
            _id: addressId,
            name: name,
            addressType: 'Home', // Default, will be updated in modal
            phone: phone,
            address: address,
            locality: locality,
            city: city,
            state: state,
            pincode: pincode,
            landMark: landMark
        };

        console.log('Extracted checkout address data:', addressData); // Debug log
        showEditAddressModal(addressData);

    } catch (error) {
        console.error('Error extracting checkout address data:', error);
        Swal.fire({
            title: '❌ Error',
            text: 'Failed to extract address data',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    }
}

function showEditAddressModal(address) {
    Swal.fire({
        title: '✏️ Edit Address',
        html: `
            <div class="text-left space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Full Name *</label>
                    <input type="text" id="editName" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                           placeholder="Enter full name" value="${address.name}" required>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Address Type *</label>
                    <select id="editAddressType" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600" required>
                        <option value="Home" ${address.addressType === 'Home' ? 'selected' : ''}>Home</option>
                        <option value="Work" ${address.addressType === 'Work' ? 'selected' : ''}>Work</option>
                        <option value="Other" ${address.addressType === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Address *</label>
                    <textarea id="editAddress" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                              placeholder="Enter full address" rows="2" required>${address.address}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Locality *</label>
                    <input type="text" id="editLocality" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                           placeholder="Enter locality/area" value="${address.locality}" required>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-2 text-gray-300">Landmark</label>
                    <input type="text" id="editLandMark" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                           placeholder="Near landmark (optional)" value="${address.landMark || ''}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">City *</label>
                        <input type="text" id="editCity" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                               placeholder="Enter city" value="${address.city}" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">State *</label>
                        <input type="text" id="editState" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                               placeholder="Enter state" value="${address.state}" required>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Pincode *</label>
                        <input type="text" id="editPincode" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                               placeholder="6-digit pincode" maxlength="6" pattern="[0-9]{6}" value="${address.pincode}" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2 text-gray-300">Phone *</label>
                        <input type="tel" id="editPhone" class="w-full p-3 border rounded bg-gray-700 text-white border-gray-600"
                               placeholder="10-digit phone" maxlength="10" pattern="[0-9]{10}" value="${address.phone}" required>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#00ffff',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '💾 Update Address',
        cancelButtonText: 'Cancel',
        background: '#1f2937',
        color: '#ffffff',
        width: '600px',
        preConfirm: () => {
            const name = document.getElementById('editName').value.trim();
            const addressType = document.getElementById('editAddressType').value;
            const addressText = document.getElementById('editAddress').value.trim();
            const locality = document.getElementById('editLocality').value.trim();
            const landMark = document.getElementById('editLandMark').value.trim();
            const city = document.getElementById('editCity').value.trim();
            const state = document.getElementById('editState').value.trim();
            const pincode = document.getElementById('editPincode').value.trim();
            const phone = document.getElementById('editPhone').value.trim();

            // Validation
            if (!name || !addressText || !locality || !city || !state || !pincode || !phone) {
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

            return {
                name,
                addressType,
                address: addressText,
                locality,
                landMark,
                city,
                state,
                pincode,
                phone
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            updateAddress(address._id, result.value);
        }
    });
}

function updateAddress(addressId, addressData) {
    // Show loading
    Swal.fire({
        title: 'Updating Address...',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#1f2937',
        color: '#ffffff',
        didOpen: () => {
            Swal.showLoading();
        }
    });

    fetch(`/profile/address/${addressId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(addressData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                title: '✅ Address Updated',
                text: 'Your address has been successfully updated',
                icon: 'success',
                confirmButtonColor: '#00ffff',
                background: '#1f2937',
                color: '#ffffff'
            }).then(() => {
                location.reload(); // Refresh to show updated address
            });
        } else {
            throw new Error(data.message || 'Failed to update address');
        }
    })
    .catch(error => {
        Swal.fire({
            title: '❌ Error',
            text: error.message || 'Failed to update address',
            icon: 'error',
            confirmButtonColor: '#00ffff',
            background: '#1f2937',
            color: '#ffffff'
        });
    });
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
