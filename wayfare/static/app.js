// Initialize map
let map = L.map('map').setView([55.7558, 37.6173], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: ' OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;
let markersLayer = null;

// Store the current route data globally
let currentRouteData = null;

// Import vehicle form manager
import VehicleFormManager from './js/vehicleForms.js';

// Initialize vehicle form manager
const vehicleFormManager = new VehicleFormManager();

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

    // Add vehicle specifications if transport type is car or motorcycle
    const vehicleSpecs = vehicleFormManager.getVehicleSpecifications();
    if (vehicleSpecs) {
        formData.vehicle_specifications = vehicleSpecs;
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
    try {
        // Store the route data globally
        currentRouteData = data;
        
        // Clear previous results
        clearMap();

        // Make sure we have valid data before proceeding
        if (!data || !data.route) {
            throw new Error('Invalid route data received');
        }
        
        // Display route on map
        displayRoute(data.route);
        
        // Update all the details tabs
        if (data.route) displayRouteDetails(data.route);
        if (data.stops) displayStopsDetails(data.stops);
        if (data.accommodation) displayAccommodationDetails(data.accommodation);
        if (data.weather) displayWeatherDetails(data.weather);
        if (data.costs) displayCostDetails(data.costs);
        if (data.health) displayHealthDetails(data.health);
        
        // Show the results container
        document.getElementById('resultsContainer').classList.remove('d-none');
    } catch (error) {
        console.error('Error displaying results:', error);
        showError('Error displaying trip details: ' + error.message);
    }
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
    console.log('Route data:', route);
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

    // Add refueling and rest stops if they exist
    if (route.segments) {
        console.log('Processing segments for stops:', route.segments);
        route.segments.forEach((segment, index) => {
            if (segment.refueling_stop) {
                console.log('Found refueling stop in segment:', index, segment.refueling_stop);
                const stop = segment.refueling_stop;
                
                // Create gas station marker
                const markerColor = '#e74c3c';  // Red color
                const markerIcon = L.divIcon({
                    html: `<div style="background-color: ${markerColor}; width: 24px; height: 24px; border-radius: 12px; display: flex; justify-content: center; align-items: center;">⛽</div>`,
                    className: 'custom-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 24],
                    popupAnchor: [0, -24]
                });

                const marker = L.marker([stop.location.latitude, stop.location.longitude], {
                    icon: markerIcon
                }).bindPopup(createStopPopup(stop));
                
                markersLayer.addLayer(marker);
            }
        });
    }

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
    const container = document.getElementById('routeDetailsContent');
    if (!container) return;

    try {
        let html = `
            <h5>Route Summary</h5>
            <p><strong>Total Distance:</strong> ${formatDistance(route.total_distance || 0)}</p>
            <p><strong>Estimated Time:</strong> ${formatDuration(route.total_duration || 0)}</p>
        `;

        if (route.segments && route.segments.length > 0) {
            html += '<h5 class="mt-3">Route Segments</h5>';
            html += '<div class="list-group">';
            route.segments.forEach(segment => {
                html += createSegmentCard(segment);
            });
            html += '</div>';
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error displaying route details:', error);
        container.innerHTML = '<div class="alert alert-danger">Error displaying route details</div>';
    }
}

function displayStopsDetails(stops) {
    const container = document.getElementById('stopsContent');
    if (!container) return;

    let html = '<div class="list-group">';
    stops.forEach(stop => {
        html += createStopCard(stop);
    });
    html += '</div>';

    container.innerHTML = html;
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

function displayWeatherDetails(weather) {
    try {
        const container = document.getElementById('weatherContent');
        if (!container) return;

        // Validate weather data
        if (!weather || (!weather.temperature && !weather.precipitation)) {
            container.innerHTML = '<div class="alert alert-warning">Weather data is not available for this route.</div>';
            return;
        }

        let html = `
            <h5>Weather Forecast</h5>
            <div class="row">
                ${weather.temperature ? `
                    <div class="col-md-6">
                        <h6>Temperature</h6>
                        <div class="chart-container">
                            <canvas id="temperatureChart"></canvas>
                        </div>
                    </div>
                ` : ''}
                ${weather.precipitation ? `
                    <div class="col-md-6">
                        <h6>Precipitation</h6>
                        <div class="chart-container">
                            <canvas id="precipitationChart"></canvas>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        container.innerHTML = html;

        // Create weather charts only if data is available
        if (weather.temperature) {
            createWeatherChart('temperatureChart', weather.temperature);
        }
        if (weather.precipitation) {
            createWeatherChart('precipitationChart', weather.precipitation);
        }
    } catch (error) {
        console.error('Error displaying weather details:', error);
        if (container) {
            container.innerHTML = '<div class="alert alert-danger">Error displaying weather information</div>';
        }
    }
}

function displayCostDetails(costs) {
    try {
        const container = document.getElementById('costsContent');
        if (!container) return;

        // Validate costs data
        if (!costs) {
            container.innerHTML = '<div class="alert alert-warning">Cost information is not available.</div>';
            return;
        }

        let html = `
            <h5>Cost Breakdown</h5>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Display fuel costs if present
        if (costs.fuel_cost) {
            html += `
                <tr>
                    <td>Fuel</td>
                    <td>${formatCurrency(costs.fuel_cost, costs.currency)}
                        ${costs.fuel_consumption ? `<br><small class="text-muted">(${costs.fuel_consumption.toFixed(1)} L)</small>` : ''}
                    </td>
                </tr>
            `;
        }

        // Display maintenance costs if present
        if (costs.maintenance_cost) {
            html += `
                <tr>
                    <td>Maintenance</td>
                    <td>${formatCurrency(costs.maintenance_cost, costs.currency)}</td>
                </tr>
            `;
        }

        // Display ticket costs for public transport
        if (costs.ticket_cost) {
            html += `
                <tr>
                    <td>Tickets</td>
                    <td>${formatCurrency(costs.ticket_cost, costs.currency)}</td>
                </tr>
            `;
        }

        // Display food and water costs if present
        if (costs.food_cost) {
            html += `
                <tr>
                    <td>Food</td>
                    <td>${formatCurrency(costs.food_cost, costs.currency)}</td>
                </tr>
            `;
        }

        if (costs.water_cost) {
            html += `
                <tr>
                    <td>Water</td>
                    <td>${formatCurrency(costs.water_cost, costs.currency)}</td>
                </tr>
            `;
        }

        // Display accommodation costs if present
        if (costs.accommodation_cost) {
            html += `
                <tr>
                    <td>Accommodation</td>
                    <td>${formatCurrency(costs.accommodation_cost, costs.currency)}</td>
                </tr>
            `;
        }

        // Display refueling stops if present
        if (costs.refueling_stops !== undefined && costs.refueling_stops !== null) {
            html += `
                <tr>
                    <td>Refueling Stops</td>
                    <td>${costs.refueling_stops}</td>
                </tr>
            `;
        }

        // Always display total cost
        html += `
                <tr class="table-primary">
                    <td><strong>Total</strong></td>
                    <td><strong>${formatCurrency(costs.total_cost || 0, costs.currency)}</strong></td>
                </tr>
            </tbody>
        </table>
        </div>`;

        container.innerHTML = html;
    } catch (error) {
        console.error('Error displaying cost details:', error);
        container.innerHTML = '<div class="alert alert-danger">Error displaying cost information</div>';
    }
}

function displayHealthDetails(health) {
    const container = document.getElementById('healthContent');
    if (!container) return;

    let html = `
        <h5>Health Impact</h5>
        <div class="alert ${health.risk_level === 'low' ? 'alert-success' : health.risk_level === 'medium' ? 'alert-warning' : 'alert-danger'}">
            <strong>Risk Level:</strong> ${health.risk_level.toUpperCase()}
        </div>
        <p>${health.description}</p>
    `;

    if (health.recommendations && health.recommendations.length > 0) {
        html += `
            <h6>Recommendations</h6>
            <ul>
                ${health.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        `;
    }

    container.innerHTML = html;
}

function createSegmentCard(segment) {
    try {
        // Format stops information if present
        let stopsHtml = '';
        if (segment.stops && segment.stops.length > 0) {
            stopsHtml = `
                <div class="mt-2">
                    <strong>Stops:</strong>
                    <ul class="mb-0">
                        ${segment.stops.map(stop => `
                            <li>${stop.type} stop - ${formatDuration(stop.duration || 0)} duration</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }

        return `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${segment.start_location.address || 'Start'} → ${segment.end_location.address || 'End'}</h6>
                        <p class="mb-1">Distance: ${formatDistance(segment.distance || 0)}</p>
                        <p class="mb-1">Driving Time: ${formatDuration(segment.duration || 0)}</p>
                        ${stopsHtml}
                        ${segment.instructions ? `
                            <small>
                                <strong>Instructions:</strong>
                                <ul class="mb-0">
                                    ${segment.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
                                </ul>
                            </small>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error creating segment card:', error);
        return '<div class="list-group-item">Error displaying segment</div>';
    }
}

function createStopCard(stop) {
    return `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${stop.name || 'Stop'}</h6>
                    <p class="mb-1">Distance: ${formatDistance(stop.distance_from_start)}</p>
                    ${stop.duration ? `<p class="mb-1">Duration: ${formatDuration(stop.duration)}</p>` : ''}
                    ${stop.fuel_needed ? `
                        <p class="mb-1">Fuel level on arrival: ${stop.fuel_level_before.toFixed(1)}L</p>
                        <p class="mb-1">Refuel amount: ${stop.fuel_needed.toFixed(1)}L</p>
                    ` : ''}
                    ${stop.facilities ? `<p class="mb-0"><small>Facilities: ${stop.facilities.join(', ')}</small></p>` : ''}
                </div>
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

function createWeatherChart(canvasId, data) {
    try {
        console.log(`Creating weather chart for ${canvasId}:`, data);
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas element ${canvasId} not found`);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error(`Could not get 2D context for ${canvasId}`);
            return;
        }

        // Validate data structure
        if (!data || !Array.isArray(data.times) || !Array.isArray(data.values)) {
            console.error(`Invalid data structure for ${canvasId}:`, data);
            return;
        }
        
        // Format times for display
        const labels = data.times.map(time => {
            if (!time) return '';
            const date = new Date(time);
            if (isNaN(date.getTime())) {
                console.error(`Invalid time value: ${time}`);
                return '';
            }
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });

        // Validate values
        const values = data.values.map(value => {
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
        });

        console.log('Chart labels:', labels);
        console.log('Chart values:', values);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: canvasId.includes('temperature') ? 'Temperature (°C)' : 'Precipitation (%)',
                        data: values,
                        borderColor: canvasId.includes('temperature') ? 'rgb(255, 99, 132)' : 'rgb(54, 162, 235)',
                        tension: 0.1,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: canvasId.includes('temperature') ? 'Temperature (°C)' : 'Precipitation (%)'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error(`Error creating weather chart ${canvasId}:`, error);
    }
}

function createStopPopup(stop) {
    let content = `<div class="stop-popup">
        <h6>${stop.name || 'Stop'}</h6>
        <p class="mb-1">Distance: ${formatDistance(stop.distance_from_start)}</p>`;

    if (stop.fuel_needed > 0) {
        content += `
            <p class="mb-1">Fuel level on arrival: ${stop.fuel_level_before.toFixed(1)}L</p>
            <p class="mb-1">Refuel amount: ${stop.fuel_needed.toFixed(1)}L</p>`;
    }

    if (stop.rest_time_needed) {
        content += `<p class="mb-1">Rest time: ${stop.rest_time_needed} minutes</p>`;
    }

    if (stop.facilities && stop.facilities.length > 0) {
        content += `<p class="mb-0"><small>Facilities: ${stop.facilities.join(', ')}</small></p>`;
    }

    content += '</div>';
    return content;
}

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
