"use strict";

/* ========================================
   KATSVTAP APPLICATION
======================================== */

/*
 * IMPORTANT:
 * The vehicle positions, available seats, speeds
 * and arrival estimates in this prototype are
 * illustrative. They are not live GPS data.
 */

const KATSINA_CENTER = [12.9908, 7.6177];


/* ========================================
   BUS STOPS
======================================== */

const busStops = [
    {
        name: "Kofar Marusa",
        position: [12.9908, 7.6177]
    },
    {
        name: "Katsina Central",
        position: [12.9970, 7.6105]
    },
    {
        name: "Central Market",
        position: [12.9918, 7.6025]
    },
    {
        name: "Kofar Sauri",
        position: [12.9790, 7.6160]
    },
    {
        name: "Kofar Kaura",
        position: [12.9950, 7.6350]
    },
    {
        name: "Government House",
        position: [12.9975, 7.6200]
    },
    {
        name: "Funtua Road",
        position: [12.9680, 7.6350]
    }
];


/* ========================================
   SEVEN SAMPLE VEHICLES
======================================== */

const vehicles = [
    {
        id: "KTS-001",
        position: [12.9870, 7.6200],
        seats: 12,
        speed: 30,
        status: "Approaching"
    },
    {
        id: "KTS-002",
        position: [12.9940, 7.6150],
        seats: 8,
        speed: 25,
        status: "Approaching"
    },
    {
        id: "KTS-003",
        position: [12.9810, 7.6120],
        seats: 15,
        speed: 35,
        status: "On Route"
    },
    {
        id: "KTS-004",
        position: [12.9890, 7.6280],
        seats: 6,
        speed: 28,
        status: "Approaching"
    },
    {
        id: "KTS-005",
        position: [12.9990, 7.6250],
        seats: 10,
        speed: 32,
        status: "On Route"
    },
    {
        id: "KTS-006",
        position: [12.9780, 7.6250],
        seats: 4,
        speed: 22,
        status: "Approaching"
    },
    {
        id: "KTS-007",
        position: [13.0020, 7.6070],
        seats: 9,
        speed: 27,
        status: "On Route"
    }
];


/* ========================================
   APPLICATION STATE
======================================== */

let map = null;

let stopMarkers = [];
let vehicleMarkers = [];

let userLocationMarker = null;

let toastTimeout = null;

let isSearching = false;

let currentSelectedStop = null;

let currentResults = [];


/* ========================================
   DOM ELEMENTS
======================================== */

const searchView =
    document.getElementById("searchView");

const resultsView =
    document.getElementById("resultsView");

const findVehiclesButton =
    document.getElementById("findVehiclesButton");

const busStopSelect =
    document.getElementById("busStop");

const loadingOverlay =
    document.getElementById("loadingOverlay");

const loadingProgressBar =
    document.getElementById("loadingProgressBar");

const loadingMessage =
    document.getElementById("loadingMessage");

const mobileMenu =
    document.getElementById("mobileMenu");

const menuButton =
    document.getElementById("menuButton");

const signInModal =
    document.getElementById("signInModal");


/* ========================================
   DISTANCE CALCULATION
======================================== */

function calculateDistance(lat1, lon1, lat2, lon2) {

    const earthRadius = 6371;

    const toRadians = degrees =>
        degrees * Math.PI / 180;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return earthRadius * c;
}


/* ========================================
   ESTIMATE VEHICLE ARRIVAL
======================================== */

function estimateArrival(distance, speed) {

    if (speed <= 0) {
        return null;
    }

    /*
     * Convert hours to minutes.
     * A minimum of one minute is shown.
     *
     * This is a simple estimate and does not
     * account for road routes, traffic or stops.
     */

    return Math.max(
        1,
        Math.round((distance / speed) * 60)
    );
}


/* ========================================
   FIND BUS STOP
======================================== */

function getSelectedBusStop() {

    const selectedName = busStopSelect.value;

    return busStops.find(stop =>
        stop.name === selectedName
    ) || null;
}


/* ========================================
   THREE-SECOND LOADING
======================================== */

findVehiclesButton.addEventListener(
    "click",
    startVehicleSearch
);

function startVehicleSearch() {

    if (isSearching) {
        return;
    }

    const selectedStop = getSelectedBusStop();

    if (!selectedStop) {

        showToast("Please select a bus stop.");

        return;
    }

    currentSelectedStop = selectedStop;

    isSearching = true;

    findVehiclesButton.disabled = true;

    findVehiclesButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Finding vehicles...</span>
    `;

    loadingProgressBar.style.width = "0%";

    loadingMessage.textContent =
        "Checking vehicles near " + selectedStop.name + "...";

    loadingOverlay.classList.remove("hidden");

    const loadingDuration = 3000;

    const startTime = Date.now();

    function updateLoading() {

        const elapsed = Date.now() - startTime;

        const progress = Math.min(
            (elapsed / loadingDuration) * 100,
            100
        );

        loadingProgressBar.style.width =
            progress + "%";

        if (progress < 100) {

            requestAnimationFrame(updateLoading);

        } else {

            finishVehicleSearch(selectedStop);

        }

    }

    requestAnimationFrame(updateLoading);
}


/* ========================================
   FINISH VEHICLE SEARCH
======================================== */

function finishVehicleSearch(selectedStop) {

    currentResults = vehicles.map(vehicle => {

        const distance = calculateDistance(
            vehicle.position[0],
            vehicle.position[1],
            selectedStop.position[0],
            selectedStop.position[1]
        );

        const roundedDistance =
            Number(distance.toFixed(2));

        const arrival = estimateArrival(
            distance,
            vehicle.speed
        );

        return {
            ...vehicle,
            distance: roundedDistance,
            arrival: arrival
        };

    }).sort((a, b) => a.distance - b.distance);

    // Update the selected destination.
    document.getElementById("selectedStopName")
        .textContent = selectedStop.name;

    // Render results.
    renderVehicleResults();

    // Update summary information.
    updateSummary();

    // Change interfaces.
    searchView.classList.add("hidden");

    resultsView.classList.remove("hidden");

    loadingOverlay.classList.add("hidden");

    findVehiclesButton.disabled = false;

    findVehiclesButton.innerHTML = `
        <i class="fa-solid fa-magnifying-glass"></i>
        <span>Find Vehicles</span>
    `;

    isSearching = false;

    // Initialize or update the map after showing results.
    initializeMap();

    // Move to the top of the results interface.
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    showToast(
        currentResults.length +
        " vehicles found near " +
        selectedStop.name
    );
}


/* ========================================
   UPDATE SUMMARY CARDS
======================================== */

function updateSummary() {

    const count = currentResults.length;

    document.getElementById("resultsCount")
        .textContent = count + " vehicles";

    document.getElementById("summaryVehicles")
        .textContent = count;

    if (count > 0) {

        const nearest = currentResults[0];

        document.getElementById("summaryDistance")
            .textContent = nearest.distance.toFixed(2) + " km";

        document.getElementById("summaryArrival")
            .textContent = nearest.arrival + " min";

        document.getElementById("resultsDescription")
            .textContent =
                count + " illustrative vehicles are sorted by distance " +
                "from " + currentSelectedStop.name +
                ". " + nearest.id + " is the nearest in this sample.";

    } else {

        document.getElementById("summaryDistance")
            .textContent = "-- km";

        document.getElementById("summaryArrival")
            .textContent = "-- min";

        document.getElementById("resultsDescription")
            .textContent = "No vehicles were found.";
    }
}


/* ========================================
   RENDER VEHICLE CARDS
======================================== */

function renderVehicleResults() {

    const vehicleList =
        document.getElementById("vehicleList");

    vehicleList.innerHTML = currentResults.map(
        (vehicle, index) => {

            const isNearest = index === 0;

            return `

                <article class="vehicle-card">

                    <div class="vehicle-card-top">

                        <div class="vehicle-icon">
                            <i class="fa-solid fa-bus"></i>
                        </div>

                        <span class="vehicle-status">
                            ${escapeHTML(vehicle.status)}
                        </span>

                    </div>

                    <h3>

                        ${escapeHTML(vehicle.id)}

                        ${isNearest
                            ? '<span class="nearest-badge">Nearest</span>'
                            : ''
                        }

                    </h3>

                    <p class="vehicle-route">

                        <i class="fa-solid fa-location-dot"></i>

                        Heading towards
                        ${escapeHTML(currentSelectedStop.name)}

                    </p>

                    <div class="vehicle-metrics">

                        <div>

                            <span class="metric-label">
                                Remaining distance
                            </span>

                            <strong class="metric-value">
                                ${vehicle.distance.toFixed(2)} km
                            </strong>

                        </div>

                        <div>

                            <span class="metric-label">
                                Estimated arrival
                            </span>

                            <strong class="metric-value">
                                ${vehicle.arrival} min
                            </strong>

                        </div>

                        <div>

                            <span class="metric-label">
                                Available seats
                            </span>

                            <strong class="metric-value">
                                ${vehicle.seats}
                            </strong>

                        </div>

                        <div>

                            <span class="metric-label">
                                Estimated speed
                            </span>

                            <strong class="metric-value">
                                ${vehicle.speed} km/h
                            </strong>

                        </div>

                    </div>

                    <button
                        class="view-map-button"
                        data-vehicle-id="${escapeHTML(vehicle.id)}">

                        <i class="fa-solid fa-location-dot"></i>

                        View on Map

                    </button>

                </article>

            `;

        }
    ).join("");

    // Connect View on Map buttons.
    vehicleList.querySelectorAll(".view-map-button")
        .forEach(button => {

            button.addEventListener("click", () => {

                focusVehicle(button.dataset.vehicleId);

            });

        });
}


/* ========================================
   MAP INITIALIZATION
======================================== */

function initializeMap() {

    if (typeof L === "undefined") {

        showToast("Map library could not be loaded.");

        return;
    }

    if (!map) {

        map = L.map("map").setView(
            currentSelectedStop.position,
            14
        );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                maxZoom: 19
            }
        ).addTo(map);

    }

    // Leaflet needs a size refresh when its container
    // changes from display:none to visible.
    setTimeout(() => {

        map.invalidateSize();

        updateMapMarkers();

    }, 150);

}


/* ========================================
   UPDATE MAP MARKERS
======================================== */

function updateMapMarkers() {

    if (!map || !currentSelectedStop) {
        return;
    }

    // Remove old bus stop markers.
    stopMarkers.forEach(marker => {

        map.removeLayer(marker);

    });

    stopMarkers = [];

    // Remove old vehicle markers.
    vehicleMarkers.forEach(marker => {

        map.removeLayer(marker);

    });

    vehicleMarkers = [];

    // Add selected bus stop.
    const stopIcon = L.divIcon({

        className: "stop-map-marker",

        html: `
            <div style="
                width: 40px;
                height: 40px;
                background: #d94343;
                color: white;
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 3px 10px rgba(0,0,0,.2);
                font-size: 16px;
            ">
                <i class="fa-solid fa-location-dot"></i>
            </div>
        `,

        iconSize: [40, 40],
        iconAnchor: [20, 20]

    });

    const stopMarker = L.marker(
        currentSelectedStop.position,
        { icon: stopIcon }
    ).addTo(map);

    stopMarker.bindPopup(`
        <strong>${escapeHTML(currentSelectedStop.name)}</strong><br>
        Selected bus stop
    `);

    stopMarkers.push(stopMarker);

    // Add all seven vehicle markers.
    currentResults.forEach(vehicle => {

        const vehicleIcon = L.divIcon({

            className: "vehicle-map-marker",

            html: `
                <div style="
                    width: 38px;
                    height: 38px;
                    background: #12683c;
                    color: #ffffff;
                    border: 3px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 3px 10px rgba(0,0,0,.25);
                    font-size: 15px;
                ">
                    <i class="fa-solid fa-bus"></i>
                </div>
            `,

            iconSize: [38, 38],
            iconAnchor: [19, 19]

        });

        const marker = L.marker(
            vehicle.position,
            { icon: vehicleIcon }
        ).addTo(map);

        marker.bindPopup(`
            <strong>${escapeHTML(vehicle.id)}</strong><br>
            Status: ${escapeHTML(vehicle.status)}<br>
            Distance: ${vehicle.distance.toFixed(2)} km<br>
            Estimated arrival: ${vehicle.arrival} min<br>
            Available seats: ${vehicle.seats}
        `);

        vehicleMarkers.push({
            id: vehicle.id,
            marker: marker
        });

    });

    // Fit map to selected stop and vehicles.
    const allMarkers = [
        stopMarker,
        ...vehicleMarkers.map(item => item.marker)
    ];

    if (allMarkers.length > 1) {

        const bounds = L.featureGroup(allMarkers)
            .getBounds()
            .pad(0.2);

        map.fitBounds(bounds, {
            maxZoom: 14
        });

    } else {

        map.setView(currentSelectedStop.position, 14);

    }

}


/* ========================================
   VIEW VEHICLE ON MAP
======================================== */

function focusVehicle(vehicleId) {

    if (!map) {
        return;
    }

    const vehicle = currentResults.find(item =>
        item.id === vehicleId
    );

    const markerItem = vehicleMarkers.find(item =>
        item.id === vehicleId
    );

    if (!vehicle || !markerItem) {
        return;
    }

    map.setView(vehicle.position, 16, {
        animate: true
    });

    markerItem.marker.openPopup();

    document.getElementById("map")
        .scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

}


/* ========================================
   MY LOCATION
======================================== */

document.getElementById("myLocationButton")
    .addEventListener("click", locateUser);

function locateUser() {

    if (!navigator.geolocation) {

        showToast(
            "Your browser does not support location services."
        );

        return;
    }

    showToast("Requesting your location...");

    navigator.geolocation.getCurrentPosition(

        position => {

            const latitude = position.coords.latitude;

            const longitude = position.coords.longitude;

            const userPosition = [
                latitude,
                longitude
            ];

            /*
             * Initialize the map if the user requests their
             * location before performing a vehicle search.
             */
            if (!map) {

                if (typeof L === "undefined") {

                    showToast("Map library could not be loaded.");

                    return;
                }

                map = L.map("map").setView(
                    userPosition,
                    15
                );

                L.tileLayer(
                    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    {
                        attribution:
                            '&copy; OpenStreetMap contributors',
                        maxZoom: 19
                    }
                ).addTo(map);

            }

            if (userLocationMarker) {

                map.removeLayer(userLocationMarker);

            }

            const userIcon = L.divIcon({

                className: "user-map-marker",

                html: `
                    <div style="
                        width: 38px;
                        height: 38px;
                        background: #3478dc;
                        color: white;
                        border: 3px solid white;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 3px 10px rgba(0,0,0,.2);
                        font-size: 15px;
                    ">
                        <i class="fa-solid fa-location-crosshairs"></i>
                    </div>
                `,

                iconSize: [38, 38],
                iconAnchor: [19, 19]

            });

            userLocationMarker = L.marker(
                userPosition,
                { icon: userIcon }
            ).addTo(map);

            userLocationMarker.bindPopup(
                "Your current location"
            ).openPopup();

            map.setView(userPosition, 16);

            // If the user is currently on the results interface,
            // refresh the map dimensions.
            setTimeout(() => {

                map.invalidateSize();

            }, 100);

            showToast("Your location has been displayed.");

        },

        error => {

            let message =
                "Unable to get your location.";

            if (error.code === error.PERMISSION_DENIED) {

                message =
                    "Please allow location access in your browser.";

            } else if (
                error.code === error.POSITION_UNAVAILABLE
            ) {

                message =
                    "Your location is currently unavailable.";

            } else if (error.code === error.TIMEOUT) {

                message =
                    "Location request timed out.";

            }

            showToast(message);

        },

        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        }

    );

}


/* ========================================
   RETURN TO SEARCH
======================================== */

document.getElementById("backToSearch")
    .addEventListener("click", returnToSearch);

document.getElementById("searchAgainButton")
    .addEventListener("click", returnToSearch);

function returnToSearch() {

    resultsView.classList.add("hidden");

    searchView.classList.remove("hidden");

    // The previous destination remains selected.
    if (currentSelectedStop) {

        busStopSelect.value = currentSelectedStop.name;

    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* ========================================
   NAVIGATION MENU
======================================== */

menuButton.addEventListener("click", () => {

    mobileMenu.classList.toggle("show");

    menuButton.innerHTML =
        mobileMenu.classList.contains("show")
            ? '<i class="fa-solid fa-xmark"></i>'
            : '<i class="fa-solid fa-bars"></i>';

});

function closeMobileMenu() {

    mobileMenu.classList.remove("show");

    menuButton.innerHTML =
        '<i class="fa-solid fa-bars"></i>';

}

document.getElementById("menuHome")
    .addEventListener("click", event => {

        event.preventDefault();

        returnToSearch();

        closeMobileMenu();

    });

document.getElementById("menuSearch")
    .addEventListener("click", event => {

        event.preventDefault();

        returnToSearch();

        closeMobileMenu();

        document.getElementById("journey")
            .scrollIntoView({
                behavior: "smooth"
            });

    });

document.getElementById("menuResults")
    .addEventListener("click", event => {

        event.preventDefault();

        closeMobileMenu();

        if (currentSelectedStop && currentResults.length > 0) {

            resultsView.classList.remove("hidden");

            searchView.classList.add("hidden");

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        } else {

            showToast("Find vehicles first to view results.");

        }

    });


/* ========================================
   SIGN-IN MODAL
======================================== */

function openSignIn() {

    signInModal.classList.add("show");

}

function closeSignIn() {

    signInModal.classList.remove("show");

}

document.getElementById("signInButton")
    .addEventListener("click", openSignIn);

document.getElementById("profileButton")
    .addEventListener("click", openSignIn);

document.getElementById("mobileSignInButton")
    .addEventListener("click", () => {

        closeMobileMenu();

        openSignIn();

    });

document.getElementById("closeSignIn")
    .addEventListener("click", closeSignIn);

signInModal.addEventListener("click", event => {

    if (event.target === signInModal) {

        closeSignIn();

    }

});

document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        closeSignIn();

        closeMobileMenu();

    }

});


/* ========================================
   SIGN-IN FORM
======================================== */

document.getElementById("signInForm")
    .addEventListener("submit", event => {

        event.preventDefault();

        /*
         * This is a frontend-only sign-in demonstration.
         * A real application needs a backend authentication
         * system before user credentials can be verified.
         */

        showToast(
            "Connect the sign-in form to your authentication system."
        );

    });


/* ========================================
   TOAST NOTIFICATIONS
======================================== */

function showToast(message) {

    const toast = document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}


/* ========================================
   SAFE HTML OUTPUT
======================================== */

function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, character => {

        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];

    });

}


/* ========================================
   HOME LOGO
======================================== */

document.getElementById("homeLogo")
    .addEventListener("click", event => {

        event.preventDefault();

        returnToSearch();

    });


/* ========================================
   INITIALIZE APPLICATION
======================================== */

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

});