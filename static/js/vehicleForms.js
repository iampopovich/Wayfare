// Vehicle form handling module
class VehicleFormManager {
    constructor() {
        this.transportationType = document.getElementById('transportationType');
        this.carDetails = document.getElementById('carDetails');
        this.motorcycleDetails = document.getElementById('motorcycleDetails');
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.transportationType.addEventListener('change', () => this.handleTransportationTypeChange());
    }

    handleTransportationTypeChange() {
        // Hide all vehicle forms first
        this.hideAllVehicleForms();
        
        // Show the appropriate form based on selection
        switch(this.transportationType.value) {
            case 'car':
                this.carDetails.classList.remove('d-none');
                break;
            case 'motorcycle':
                this.motorcycleDetails.classList.remove('d-none');
                break;
        }
    }

    hideAllVehicleForms() {
        this.carDetails.classList.add('d-none');
        this.motorcycleDetails.classList.add('d-none');
    }

    getVehicleSpecifications() {
        switch(this.transportationType.value) {
            case 'car':
                return this.getCarSpecifications();
            case 'motorcycle':
                return this.getMotorcycleSpecifications();
            default:
                return null;
        }
    }

    getCarSpecifications() {
        return {
            model: document.getElementById('carModel').value || 'Standard 1.6L',
            engineVolume: parseFloat(document.getElementById('engineVolume').value) || 1.6,
            fuelConsumption: parseFloat(document.getElementById('fuelConsumption').value) || 11.0,
            fuelType: document.getElementById('fuelType').value || 'gasoline',
            tankCapacity: parseFloat(document.getElementById('tankCapacity').value) || 50.0,
            initialFuel: parseFloat(document.getElementById('initialFuel').value) || 25.0,
            baseMass: 1200.0,
            passenger_mass: 75.0
        };
    }

    getMotorcycleSpecifications() {
        return {
            engineCC: parseFloat(document.getElementById('engineCC').value) || 125,
            fuelEconomy: parseFloat(document.getElementById('motorcycleFuelConsumption').value) || 45,
            tankCapacity: parseFloat(document.getElementById('motorcycleTankCapacity').value) || 10.0,
            initialFuel: parseFloat(document.getElementById('motorcycleInitialFuel').value) || 5.0,
            fuelType: document.getElementById('motorcycleFuelType').value || '92',
            baseMass: 150.0,
            passengerMass: 75.0
        };
    }

    calculateFuelNeeded(distance, type) {
        switch(type) {
            case 'car': {
                const consumption = parseFloat(document.getElementById('fuelConsumption').value) || 11.0;
                return (distance / 100) * consumption; // L/100km to total liters
            }
            case 'motorcycle': {
                const economy = parseFloat(document.getElementById('motorcycleFuelConsumption').value) || 45;
                return distance / economy; // km/L to total liters
            }
            default:
                return 0;
        }
    }

    calculateRefuelingStops(distance, type) {
        const specs = this.getVehicleSpecifications();
        if (!specs) return 0;

        const fuelNeeded = this.calculateFuelNeeded(distance, type);
        const remainingFuel = specs.initialFuel - fuelNeeded;
        return Math.max(0, Math.ceil(-remainingFuel / specs.tankCapacity));
    }
}

// Export for use in other modules
export default VehicleFormManager;
