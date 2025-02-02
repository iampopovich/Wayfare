// Initialize map
let map = L.map('map').setView([55.7558, 37.6173], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: ' OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;
let markersLayer = null;

// Form handling
document.getElementById('transportationType').addEventListener('change', function(e) {
    const carDetails = document.getElementById('carDetails');
    if (e.target.value === 'car') {
        carDetails.classList.remove('d-none');
    } else {
        carDetails.classList.add('d-none');
    }
});

document.getElementById('tripForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Show loading state
    showLoading();
    
    // Gather form data
    const formData = {
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
        transportation_type: document.getElementById('transportationType').value,
        car_model: document.getElementById('carModel').value,
        passengers: parseInt(document.getElementById('passengers').value),
        budget: {
            min_amount: parseFloat(document.getElementById('minBudget').value),
            max_amount: parseFloat(document.getElementById('maxBudget').value),
            currency: document.getElementById('currency').value
        },
        overnight_stay: {
            required: document.getElementById('overnightStay').checked
        }
    };

    try {
        // Call API
        const response = await fetch('/api/v1/travel/route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Failed to plan trip');
        }
        
        // Update UI with results
        displayResults(data);
    } catch (error) {
        showError('Error planning trip: ' + error.message);
    } finally {
        hideLoading();
    }
});

function displayResults(data) {
    // Clear previous results
    clearMap();
    
    // Display route on map
    displayRoute(data.route);
    
    // Update route details tab
    displayRouteDetails(data.route);
    
    // Update stops tab
    displayStopsDetails(data.stops);
    
    // Update accommodation tab
    if (data.accommodation) {
        displayAccommodationDetails(data.accommodation);
    }
    
    // Update costs tab
    displayCostDetails(data.total_costs);
    
    // Update health tab
    displayHealthDetails(data.calories);
}

function displayRoute(route) {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    if (markersLayer) {
        map.removeLayer(markersLayer);
    }

    // Add route polyline
    const coordinates = route.segments.map(segment => [
        segment.start_location.latitude,
        segment.start_location.longitude
    ]);
    coordinates.push([
        route.segments[route.segments.length - 1].end_location.latitude,
        route.segments[route.segments.length - 1].end_location.longitude
    ]);

    routeLayer = L.polyline(coordinates, {color: '#4a90e2'}).addTo(map);
    map.fitBounds(routeLayer.getBounds());

    // Add markers for stops
    markersLayer = L.layerGroup().addTo(map);
    route.segments.forEach(segment => {
        // Start point
        L.marker([segment.start_location.latitude, segment.start_location.longitude])
            .bindPopup(createStopPopup(segment))
            .addTo(markersLayer);
    });
}

function displayRouteDetails(route) {
    const container = document.getElementById('routeDetails');
    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Route Summary</h5>
            <div class="result-detail">
                <p><strong>Total Distance:</strong> ${formatDistance(route.total_distance)}</p>
                <p><strong>Total Duration:</strong> ${formatDuration(route.total_duration)}</p>
                <p><strong>Total Cost:</strong> ${formatCurrency(route.total_cost, route.currency)}</p>
            </div>
        </div>
        ${route.segments.map(segment => createSegmentCard(segment)).join('')}
    `;
}

function displayStopsDetails(stops) {
    const container = document.getElementById('stopsDetails');
    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Planned Stops</h5>
            ${Object.entries(stops.stop_types).map(([type, stops]) => `
                <div class="mb-3">
                    <h6 class="text-capitalize">${type} Stops</h6>
                    ${stops.map(stop => createStopCard(stop)).join('')}
                </div>
            `).join('')}
        </div>
    `;
}

function displayAccommodationDetails(accommodation) {
    const container = document.getElementById('accommodationDetails');
    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Recommended Stays</h5>
            ${accommodation.recommended_stays.map(stay => createAccommodationCard(stay)).join('')}
        </div>
    `;
}

function displayCostDetails(costs) {
    const container = document.getElementById('costsDetails');
    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Cost Breakdown</h5>
            <div class="cost-breakdown">
                ${Object.entries(costs.cost_breakdown).map(([category, amount]) => `
                    <div class="cost-item">
                        <span class="cost-label text-capitalize">${category}</span>
                        <span class="cost-value">${formatCurrency(amount, costs.currency)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="mt-3">
                <h6>Cost Optimization Tips</h6>
                <ul>
                    ${costs.cost_optimization_tips.map(tip => `<li>${tip}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
}

function displayHealthDetails(health) {
    const container = document.getElementById('healthDetails');
    container.innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <div class="health-stat">
                    <div class="health-stat-value">${health.total_calories}</div>
                    <div class="health-stat-label">Total Calories</div>
                </div>
            </div>
            <div class="col-md-8">
                <div class="result-card">
                    <h5 class="result-title">Activity Breakdown</h5>
                    ${Object.entries(health.activity_breakdown).map(([activity, calories]) => `
                        <div class="d-flex justify-content-between mb-2">
                            <span class="text-capitalize">${activity}</span>
                            <span>${calories} calories</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Utility functions
function formatDistance(meters) {
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

function formatCurrency(amount, currency) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

function createStopPopup(segment) {
    return `
        <div class="popup-content">
            <h6>${segment.start_location.address || 'Stop'}</h6>
            <p>Duration: ${formatDuration(segment.duration)}</p>
            ${segment.overnight_stay ? `
                <p>Overnight Stay: ${segment.overnight_stay.name}</p>
            ` : ''}
        </div>
    `;
}

function createSegmentCard(segment) {
    return `
        <div class="result-card">
            <div class="d-flex justify-content-between align-items-center">
                <h6>${segment.start_location.address} → ${segment.end_location.address}</h6>
                <span class="badge bg-primary">${segment.transportation.type}</span>
            </div>
            <div class="result-detail">
                <p>Distance: ${formatDistance(segment.distance)}</p>
                <p>Duration: ${formatDuration(segment.duration)}</p>
                <p>Cost: ${formatCurrency(segment.total_segment_cost, 'USD')}</p>
            </div>
        </div>
    `;
}

function createStopCard(stop) {
    return `
        <div class="result-card">
            <div class="result-detail">
                <p><strong>Location:</strong> ${stop.location.address}</p>
                <p><strong>Duration:</strong> ${formatDuration(stop.duration)}</p>
                <p><strong>Available Facilities:</strong> ${stop.facilities.join(', ')}</p>
            </div>
        </div>
    `;
}

function createAccommodationCard(stay) {
    return `
        <div class="result-card">
            <h6>${stay.name}</h6>
            <div class="result-detail">
                <p><strong>Price:</strong> ${formatCurrency(stay.price_per_night, 'USD')} per night</p>
                <p><strong>Rating:</strong> ${stay.rating} ⭐ (${stay.reviews_count} reviews)</p>
                <p><strong>Distance to Center:</strong> ${formatDistance(stay.distance_to_center)}</p>
            </div>
        </div>
    `;
}

function showLoading() {
    // Implement loading state
}

function hideLoading() {
    // Hide loading state
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
    setTimeout(() => {
        errorDiv.classList.add('d-none');
    }, 5000);
}

function clearMap() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    if (markersLayer) {
        map.removeLayer(markersLayer);
    }
}
