document.addEventListener('DOMContentLoaded', function() {
    // Initialize map
    const map = L.map('map').setView([55.7558, 37.6173], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Get form elements
    const tripForm = document.getElementById('tripForm');
    const transportationType = document.getElementById('transportationType');
    const carDetails = document.getElementById('carDetails');
    const motorcycleDetails = document.getElementById('motorcycleDetails');
    const errorMessage = document.getElementById('errorMessage');

    // Show/hide vehicle details based on transportation type
    transportationType.addEventListener('change', function() {
        carDetails.classList.add('d-none');
        motorcycleDetails.classList.add('d-none');

        switch(this.value) {
            case 'car':
                carDetails.classList.remove('d-none');
                break;
            case 'motorcycle':
                motorcycleDetails.classList.remove('d-none');
                break;
        }
    });

    // Handle form submission
    tripForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const origin = document.getElementById('origin').value;
        const destination = document.getElementById('destination').value;
        const transport = transportationType.value;

        try {
            // Calculate route based on transportation type
            let routeDetails = {};
            
            if (transport === 'motorcycle') {
                const engineCC = parseFloat(document.getElementById('engineCC').value);
                const fuelEconomy = parseFloat(document.getElementById('motorcycleFuelConsumption').value);
                const tankCapacity = parseFloat(document.getElementById('motorcycleTankCapacity').value);
                const currentFuel = parseFloat(document.getElementById('motorcycleInitialFuel').value);
                const fuelType = document.getElementById('motorcycleFuelType').value;

                routeDetails = calculateMotorcycleRoute(
                    origin,
                    destination,
                    engineCC,
                    fuelEconomy,
                    tankCapacity,
                    currentFuel,
                    fuelType
                );
            }
            // Add other transportation calculations here...

            // Update UI with route details
            updateRouteDisplay(routeDetails);
            
        } catch (error) {
            showError(error.message);
        }
    });

    function calculateMotorcycleRoute(origin, destination, engineCC, fuelEconomy, tankCapacity, currentFuel, fuelType) {
        // This is a placeholder for the actual route calculation
        // You would typically make an API call to a routing service here
        
        // Example calculation
        const distance = 100; // km (placeholder - should come from routing API)
        const fuelNeeded = distance / fuelEconomy;
        const remainingFuel = currentFuel - fuelNeeded;
        const refuelingStops = Math.max(0, Math.ceil(-remainingFuel / tankCapacity));
        
        return {
            distance: distance,
            fuelConsumption: fuelNeeded.toFixed(2),
            remainingFuel: Math.max(0, remainingFuel).toFixed(2),
            refuelingStops: refuelingStops,
            engineSize: engineCC + 'cc',
            fuelType: fuelType
        };
    }

    function updateRouteDisplay(details) {
        // Update the UI with route details
        const resultsDiv = document.createElement('div');
        resultsDiv.innerHTML = `
            <h4>Route Details</h4>
            <p>Distance: ${details.distance} km</p>
            <p>Fuel Consumption: ${details.fuelConsumption} L</p>
            <p>Remaining Fuel: ${details.remainingFuel} L</p>
            <p>Refueling Stops Needed: ${details.refuelingStops}</p>
            <p>Engine Size: ${details.engineSize}</p>
            <p>Fuel Type: ${details.fuelType}</p>
        `;

        // Clear previous results and add new ones
        const resultsContainer = document.getElementById('routeResults');
        resultsContainer.innerHTML = '';
        resultsContainer.appendChild(resultsDiv);
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('d-none');
        setTimeout(() => {
            errorMessage.classList.add('d-none');
        }, 5000);
    }
});
