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
    if (data.stops && data.stops.length > 0) {
        displayStopsDetails(data.stops);
    }
    
    // Update costs tab
    displayCostDetails(data.costs);
    
    // Update health tab
    displayHealthDetails(data.health);
}

function displayRoute(route) {
    clearMap();

    // Create markers and polyline layers
    routeLayer = L.layerGroup();
    markersLayer = L.layerGroup();

    // Add start and end markers
    const firstSegment = route.segments[0];
    const lastSegment = route.segments[route.segments.length - 1];

    const startMarker = L.marker([firstSegment.start_location.latitude, firstSegment.start_location.longitude])
        .bindPopup('Start: ' + firstSegment.start_location.address);
    const endMarker = L.marker([lastSegment.end_location.latitude, lastSegment.end_location.longitude])
        .bindPopup('End: ' + lastSegment.end_location.address);

    markersLayer.addLayer(startMarker);
    markersLayer.addLayer(endMarker);

    // Create path from coordinates
    const pathCoordinates = route.path_points.map(point => [point[0], point[1]]);
    const routePath = L.polyline(pathCoordinates, {
        color: '#3388ff',
        weight: 5,
        opacity: 0.8
    });

    routeLayer.addLayer(routePath);

    // Add all layers to map
    routeLayer.addTo(map);
    markersLayer.addTo(map);

    // Fit map bounds to show entire route
    const bounds = routePath.getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
}

function displayRouteDetails(route) {
    const container = document.getElementById('routeDetails');
    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Route Summary</h5>
            <div class="result-detail">
                <p><strong>Total Distance:</strong> ${formatDistance(route.total_distance)}</p>
                <p><strong>Total Duration:</strong> ${formatDuration(route.total_duration)}</p>
            </div>
            <div class="route-segments mt-3">
                <h6>Route Segments</h6>
                ${route.segments.map((segment, index) => `
                    <div class="segment-card mb-2">
                        <div class="segment-header">
                            <strong>Segment ${index + 1}</strong>
                        </div>
                        <div class="segment-details">
                            <p class="mb-1"><small>From: ${segment.start_location.address || 'Start'}</small></p>
                            <p class="mb-1"><small>To: ${segment.end_location.address || 'End'}</small></p>
                            <p class="mb-1"><small>Distance: ${formatDistance(segment.distance)}</small></p>
                            <p class="mb-1"><small>Duration: ${formatDuration(segment.duration)}</small></p>
                        </div>
                        ${segment.instructions.length > 0 ? `
                            <div class="segment-instructions">
                                <small>
                                    <strong>Instructions:</strong>
                                    <ul class="mb-0">
                                        ${segment.instructions.map(instruction => `
                                            <li>${instruction}</li>
                                        `).join('')}
                                    </ul>
                                </small>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function displayStopsDetails(stops) {
    const container = document.getElementById('stopsDetails');
    if (!stops || stops.length === 0) {
        container.innerHTML = `
            <div class="result-card">
                <h5 class="result-title">Planned Stops</h5>
                <p>No stops planned for this route.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Planned Stops</h5>
            ${stops.map(stop => `
                <div class="stop-card mb-3">
                    <h6>${stop.type} Stop</h6>
                    <p class="mb-1"><small>Location: ${stop.location.address}</small></p>
                    <p class="mb-1"><small>Duration: ${formatDuration(stop.duration)}</small></p>
                    ${stop.facilities.length > 0 ? `
                        <p class="mb-0"><small>Facilities: ${stop.facilities.join(', ')}</small></p>
                    ` : ''}
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
                ${Object.entries(costs.breakdown).map(([category, amount]) => `
                    <div class="cost-item">
                        <span class="cost-label text-capitalize">${category}</span>
                        <span class="cost-value">${formatCurrency(amount, costs.currency)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="mt-3">
                <h6>Total Cost</h6>
                <div class="cost-item total-cost">
                    <span class="cost-value">${formatCurrency(costs.total_amount, costs.currency)}</span>
                </div>
            </div>
        </div>
    `;
}

function displayHealthDetails(health) {
    const container = document.getElementById('healthDetails');
    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Health Impact</h5>
            <div class="health-details">
                <p><strong>Total Calories Burned:</strong> ${Math.round(health.total_calories)} kcal</p>
                <div class="activity-breakdown mt-3">
                    <h6>Activity Breakdown</h6>
                    ${Object.entries(health.activity_breakdown).map(([activity, calories]) => `
                        <div class="activity-item">
                            <span class="activity-label text-capitalize">${activity}</span>
                            <span class="activity-value">${Math.round(calories)} kcal</span>
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

function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD'  // Default to USD if currency is not provided
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
