// Initialize map
let map = L.map('map').setView([55.7558, 37.6173], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: ' OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;
let markersLayer = null;

// Store the current route data globally
let currentRouteData = null;

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
    
    // Validate transportation type
    const transportationType = document.getElementById('transportationType').value;
    if (transportationType === 'empty') {
        showError('Please select a transportation type');
        return;
    }
    
    // Show loading state
    showLoading();
    
    // Gather form data
    const formData = {
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
        transportation_type: transportationType,
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

    // Add car specifications if transport type is car
    if (formData.transportation_type === 'car') {
        formData.car_specifications = {
            model: document.getElementById('carModel').value || 'Standard 1.6L',
            engine_volume: parseFloat(document.getElementById('engineVolume').value) || 1.6,
            fuel_consumption: parseFloat(document.getElementById('fuelConsumption').value) || 11.0,
            fuel_type: document.getElementById('fuelType').value || 'gasoline',
            tank_capacity: parseFloat(document.getElementById('tankCapacity').value) || 50.0,
            initial_fuel: parseFloat(document.getElementById('initialFuel').value) || 25.0,
            base_mass: 1200.0,
            passenger_mass: 75.0
        };
    }

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
    // Store the route data globally
    currentRouteData = data;
    
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
    
    // Show share button
    document.getElementById('shareRouteButton').classList.remove('d-none');
}

function shareRoute() {
    if (!currentRouteData) {
        showError('No route available to share');
        return;
    }

    const { route, stops } = currentRouteData;
    
    // Start with origin
    const firstSegment = route.segments[0];
    let waypoints = [`${firstSegment.start_location.latitude},${firstSegment.start_location.longitude}`];
    
    // Add stops as waypoints
    if (stops && stops.length > 0) {
        const stopWaypoints = stops.map(stop => 
            `${stop.location.latitude},${stop.location.longitude}`
        );
        waypoints = waypoints.concat(stopWaypoints);
    }
    
    // Add destination
    const lastSegment = route.segments[route.segments.length - 1];
    waypoints.push(`${lastSegment.end_location.latitude},${lastSegment.end_location.longitude}`);
    
    // Create Google Maps URL
    const origin = waypoints.shift();
    const destination = waypoints.pop();
    const waypointsParam = waypoints.length > 0 
        ? `&waypoints=${waypoints.join('|')}` 
        : '';
    
    // Get travel mode
    const travelMode = document.getElementById('transportationType').value;
    const googleMapsMode = {
        'car': 'driving',
        'walking': 'walking',
        'bicycle': 'bicycling',
        'bus': 'transit',
        'train': 'transit'
    }[travelMode] || 'driving';
    
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsParam}&travelmode=${googleMapsMode}`;
    
    // Open in new tab
    window.open(googleMapsUrl, '_blank');
}

document.getElementById('shareRouteButton').addEventListener('click', shareRoute);

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
        container.innerHTML = '<p>No stops required for this journey.</p>';
        return;
    }

    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Planned Stops</h5>
            ${stops.map((stop, index) => `
                <div class="stop-card mb-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6>${stop.name || `Stop ${index + 1}`}</h6>
                            <p class="mb-1">Distance: ${typeof stop.distance_from_start === 'number' ? stop.distance_from_start : 0}km from start</p>
                            <p class="mb-1">Estimated arrival: ${typeof stop.estimated_arrival_time === 'number' ? formatDuration(stop.estimated_arrival_time) : '0h 0m'}</p>
                            ${stop.fuel_level_before !== undefined ? `
                                <p class="mb-1">Fuel level on arrival: ${typeof stop.fuel_level_before === 'number' ? stop.fuel_level_before : 0}L</p>
                                ${stop.fuel_needed > 0 ? `
                                    <p class="mb-1">Refuel needed: ${typeof stop.fuel_needed === 'number' ? stop.fuel_needed : 0}L</p>
                                ` : ''}
                            ` : ''}
                            ${stop.rest_time_needed ? `
                                <p class="mb-1">Rest duration: ${stop.rest_time_needed} minutes</p>
                            ` : ''}
                            <p class="mb-0"><small>Type: ${stop.type}</small></p>
                            ${stop.facilities && stop.facilities.length > 0 ? `
                                <p class="mb-0"><small>Facilities: ${stop.facilities.join(', ')}</small></p>
                            ` : ''}
                        </div>
                    </div>
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
    
    // Create cost items array from available costs
    const costItems = [];
    if (costs.fuel_cost) costItems.push(['Fuel', costs.fuel_cost]);
    if (costs.ticket_cost) costItems.push(['Tickets', costs.ticket_cost]);
    if (costs.food_cost) costItems.push(['Food', costs.food_cost]);
    if (costs.water_cost) costItems.push(['Water', costs.water_cost]);
    if (costs.accommodation_cost) costItems.push(['Accommodation', costs.accommodation_cost]);

    // Additional details for car travel
    const carDetails = [];
    if (costs.fuel_consumption) carDetails.push(`Fuel consumption: ${costs.fuel_consumption.toFixed(1)}L`);
    if (costs.refueling_stops) carDetails.push(`Refueling stops needed: ${costs.refueling_stops}`);
    
    // Get car specifications from the form if it's a car journey
    const transportationType = document.getElementById('transportationType').value;
    if (transportationType === 'car') {
        const passengers = parseInt(document.getElementById('passengers').value);
        const baseMass = 1200; // kg
        const passengerMass = 75; // kg per passenger
        const totalMass = baseMass + (passengerMass * passengers);
        
        carDetails.unshift(
            `Vehicle mass: ${baseMass}kg`,
            `Passengers: ${passengers} × ${passengerMass}kg = ${passengerMass * passengers}kg`,
            `Total mass: ${totalMass}kg`
        );
    }

    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Cost Breakdown</h5>
            <div class="cost-breakdown">
                ${costItems.map(([category, amount]) => `
                    <div class="cost-item">
                        <span class="cost-label">${category}</span>
                        <span class="cost-value">${formatCurrency(amount, costs.currency)}</span>
                    </div>
                `).join('')}
            </div>
            ${carDetails.length > 0 ? `
                <div class="car-details mt-3">
                    <h6>Journey Details</h6>
                    ${carDetails.map(detail => `<p class="mb-1">${detail}</p>`).join('')}
                </div>
            ` : ''}
            <div class="mt-3">
                <h6>Total Cost</h6>
                <div class="cost-item total-cost">
                    <span class="cost-value">${formatCurrency(costs.total_cost, costs.currency)}</span>
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
    if (typeof minutes !== 'number' || isNaN(minutes)) {
        return '0h 0m';
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
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
