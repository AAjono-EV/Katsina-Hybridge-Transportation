/* KATSVTAP - complete front-end user section.
   Demo vehicle coordinates are simulated. No real-time GPS feed is connected. */
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const STORAGE = {
    users: "katsvtap_users",
    currentUser: "katsvtap_current_user",
    notifications: "katsvtap_notifications"
  };

  // Approximate sample locations around Katsina town. Replace with verified coordinates for deployment.
  const busStops = [
    { id: "kofar-sauri", name: "Kofar Sauri", lat: 12.9906, lng: 7.6005 },
    { id: "kofar-marusa", name: "Kofar Marusa", lat: 12.9978, lng: 7.6100 },
    { id: "kofar-kaura", name: "Kofar Kaura", lat: 12.9851, lng: 7.5927 },
    { id: "central", name: "Katsina Central", lat: 12.9908, lng: 7.6012 },
    { id: "dutsin-ma-road", name: "Dutsin-Ma Road", lat: 12.9758, lng: 7.6200 }
  ];

  // Simulated vehicle locations. They drift slightly each update to demonstrate changing estimates.
  let vehicles = [
    { id: "V001", plate: "KT 123 ABC", type: "Mini bus", destination: "Katsina Central", route: "Kofar Sauri Route", lat: 12.9848, lng: 7.5994, speed: 28, heading: "towards", active: true },
    { id: "V002", plate: "KT 456 DEF", type: "Bus", destination: "Kofar Marusa", route: "Marusa Route", lat: 12.9890, lng: 7.6060, speed: 24, heading: "towards", active: true },
    { id: "V003", plate: "KT 789 GHI", type: "Hybrid vehicle", destination: "Kofar Kaura", route: "Kaura Route", lat: 12.9790, lng: 7.5905, speed: 32, heading: "towards", active: true },
    { id: "V004", plate: "KT 246 JKL", type: "Mini bus", destination: "Dutsin-Ma Road", route: "Dutsin-Ma Route", lat: 12.9695, lng: 7.6150, speed: 26, heading: "towards", active: true },
    { id: "V005", plate: "KT 135 MNO", type: "Bus", destination: "Katsina Central", route: "Central Route", lat: 13.0020, lng: 7.6040, speed: 20, heading: "away", active: true }
  ];

  let selectedStopId = busStops[0].id;
  let authMode = "login";
  let mainMap = null;
  let miniMap = null;
  let mainMarkers = [];
  let miniMarkers = [];
  let currentUser = readJSON(STORAGE.currentUser, null);
  let notifications = readJSON(STORAGE.notifications, []);

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }
  function getStop(id) { return busStops.find(stop => stop.id === id) || busStops[0]; }
  function distanceKm(aLat, aLng, bLat, bLng) {
    const rad = value => value * Math.PI / 180;
    const dLat = rad(bLat - aLat);
    const dLng = rad(bLng - aLng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function estimateVehicles(stopId) {
    const stop = getStop(stopId);
    return vehicles.filter(vehicle => vehicle.active && vehicle.heading === "towards")
      .map(vehicle => {
        const straightDistance = distanceKm(vehicle.lat, vehicle.lng, stop.lat, stop.lng);
        // A small multiplier approximates road distance; actual routing data is needed for real road distance.
        const roadDistance = straightDistance * 1.25;
        const eta = Math.max(1, Math.ceil((roadDistance / Math.max(vehicle.speed, 5)) * 60));
        return { ...vehicle, distance: roadDistance, eta, stop };
      })
      .sort((a, b) => a.distance - b.distance);
  }
  function populateStopSelects() {
    ["busStopSelect", "nearbyStopSelect", "mapStopSelect"].forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = busStops.map(stop =>
        `<option value="${stop.id}">${escapeHTML(stop.name)}</option>`).join("");
      select.value = selectedStopId;
    });
  }
  function vehicleRow(vehicle) {
    return `<article class="vehicle-row">
      <span class="vehicle-symbol"><i class="fa-solid fa-bus-simple"></i></span>
      <div><h4>${escapeHTML(vehicle.plate)} <span class="status-chip"><i class="fa-solid fa-arrow-trend-up"></i> Approaching</span></h4>
        <p>${escapeHTML(vehicle.type)} · ${escapeHTML(vehicle.route)}<br><i class="fa-solid fa-location-dot"></i> ${escapeHTML(vehicle.destination)}</p>
      </div>
      <div class="row-metrics"><strong>${vehicle.distance.toFixed(1)} km</strong><span>about ${vehicle.eta} min</span></div>
    </article>`;
  }
  function renderNearest() {
    const list = estimateVehicles(selectedStopId);
    $("#nearbyCount").textContent = list.length;
    $("#nearestDistance").innerHTML = list.length ? `${list[0].distance.toFixed(1)} <small>km</small>` : `-- <small>km</small>`;
    $("#nearestEta").innerHTML = list.length ? `${list[0].eta} <small>min</small>` : `-- <small>min</small>`;

    if (!list.length) {
      $("#nearestVehicleCard").innerHTML = `<div class="nearest-empty"><span class="empty-icon"><i class="fa-solid fa-bus-simple"></i></span><h4>No approaching vehicles found</h4><p>Try another bus stop. No simulated vehicle is currently marked as approaching.</p></div>`;
      $("#homeVehicleList").innerHTML = `<div class="empty-list"><i class="fa-solid fa-bus"></i>No approaching vehicles for this stop.</div>`;
    } else {
      const v = list[0];
      $("#nearestVehicleCard").innerHTML = `<div class="nearest-detail-top">
        <span class="vehicle-symbol"><i class="fa-solid fa-bus-simple"></i></span>
        <div style="flex:1;min-width:0"><p class="vehicle-name">${escapeHTML(v.plate)}</p><p class="vehicle-subtitle">${escapeHTML(v.type)} · ${escapeHTML(v.route)}</p></div>
        <span class="status-chip"><i class="fa-solid fa-circle"></i> Approaching</span>
      </div>
      <div class="nearest-metrics">
        <div class="metric-box"><span><i class="fa-solid fa-route"></i> Distance remaining</span><strong>${v.distance.toFixed(1)} <small>km</small></strong></div>
        <div class="metric-box"><span><i class="fa-regular fa-clock"></i> Estimated arrival</span><strong>${v.eta} <small>min</small></strong></div>
      </div>
      <div class="destination-line"><i class="fa-solid fa-location-dot"></i><span>Destination: <strong>${escapeHTML(v.destination)}</strong></span></div>
      <div class="destination-line"><i class="fa-solid fa-map-pin"></i><span>Selected stop: <strong>${escapeHTML(v.stop.name)}</strong></span></div>`;
      $("#homeVehicleList").innerHTML = list.slice(0, 3).map(vehicleRow).join("");
    }
    renderAllVehicles();
    renderMaps();
  }
  function renderAllVehicles() {
    const stopId = $("#nearbyStopSelect")?.value || selectedStopId;
    const sort = $("#sortVehicles")?.value || "distance";
    const list = estimateVehicles(stopId);
    list.sort((a, b) => sort === "eta" ? a.eta - b.eta : a.distance - b.distance);
    $("#allVehicleList").innerHTML = list.length ? list.map(vehicleRow).join("") :
      `<div class="empty-list"><i class="fa-solid fa-bus"></i>No approaching vehicles found for this stop.</div>`;
  }
  function addNotification(title, message) {
    notifications.unshift({ id: Date.now(), title, message, time: new Date().toLocaleString() });
    notifications = notifications.slice(0, 20);
    localStorage.setItem(STORAGE.notifications, JSON.stringify(notifications));
    renderNotifications();
  }
  function renderNotifications() {
    $("#notificationCount").textContent = notifications.length;
    $("#notificationList").innerHTML = notifications.length ? notifications.map(item =>
      `<div class="notification-item"><span class="notification-icon"><i class="fa-solid fa-bus"></i></span><div><h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.message)}</p><small>${escapeHTML(item.time)}</small></div></div>`
    ).join("") : `<div class="empty-list"><i class="fa-regular fa-bell"></i>You have no notifications yet. Vehicle updates will appear here.</div>`;
  }
  function updateAccountUI() {
    $("#accountName").textContent = currentUser ? currentUser.name.split(" ")[0] : "Guest";
    $("#authButton").textContent = currentUser ? "Sign out" : "Sign in";
  }
  function showView(view) {
    const validViews = ["home", "nearby", "map", "notifications"];
    if (!validViews.includes(view)) view = "home";
    $$(".view-section").forEach(section => section.classList.add("hidden"));
    $(`#view-${view}`).classList.remove("hidden");
    $$(".nav-link").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
    $("#topNav").classList.remove("open");
    if (view === "nearby") renderAllVehicles();
    if (view === "map") setTimeout(() => { initMaps(); if (mainMap) mainMap.invalidateSize(); renderMaps(); }, 100);
  }
  function initMaps() {
    if (typeof L === "undefined") {
      $("#miniMap").innerHTML = '<div class="empty-list">Map library could not load. Check your internet connection.</div>';
      $("#mainMap").innerHTML = '<div class="empty-list">Map library could not load. Check your internet connection.</div>';
      return;
    }
    if (!miniMap) {
      miniMap = L.map("miniMap", { scrollWheelZoom: false }).setView([12.9906, 7.6005], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(miniMap);
    }
    if (!mainMap) {
      mainMap = L.map("mainMap").setView([12.9906, 7.6005], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(mainMap);
    }
  }
  function renderMaps() {
    if (typeof L === "undefined") return;
    initMaps();
    const stop = getStop($("#mapStopSelect")?.value || selectedStopId);
    const list = estimateVehicles(stop.id);
    [ [miniMap, miniMarkers], [mainMap, mainMarkers] ].forEach(([map, markers]) => {
      if (!map) return;
      markers.forEach(marker => map.removeLayer(marker));
      markers.length = 0;
      const stopMarker = L.marker([stop.lat, stop.lng]).addTo(map)
        .bindPopup(`<strong>${escapeHTML(stop.name)}</strong><br>Selected bus stop`);
      markers.push(stopMarker);
      list.forEach(v => {
        const marker = L.marker([v.lat, v.lng]).addTo(map)
          .bindPopup(`<strong>${escapeHTML(v.plate)}</strong><br>${v.distance.toFixed(1)} km away<br>Estimated arrival: ${v.eta} min`);
        markers.push(marker);
      });
      map.setView([stop.lat, stop.lng], 13);
    });
  }
  function setSelectedStop(stopId) {
    selectedStopId = stopId;
    ["busStopSelect", "nearbyStopSelect", "mapStopSelect"].forEach(id => {
      const select = document.getElementById(id);
      if (select) select.value = stopId;
    });
    renderNearest();
  }
  function openAuth(mode = "login") {
    setAuthMode(mode);
    $("#authModal").classList.remove("hidden");
    $("#authMessage").textContent = "";
    $("#authEmail").focus();
  }
  function closeAuth() { $("#authModal").classList.add("hidden"); }
  function setAuthMode(mode) {
    authMode = mode;
    $$(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.authMode === mode));
    $("#fullNameField").classList.toggle("hidden", mode !== "register");
    $("#authTitle").textContent = mode === "login" ? "Welcome back" : "Create your account";
    $("#authSubtitle").textContent = mode === "login" ? "Sign in to personalise your journey." : "Create a local demo account to get started.";
    $("#authSubmit").textContent = mode === "login" ? "Sign in" : "Create account";
    $("#authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("#authMessage").textContent = "";
  }
  function handleAuthSubmit(event) {
    event.preventDefault();
    const name = $("#fullName").value.trim();
    const email = $("#authEmail").value.trim().toLowerCase();
    const password = $("#authPassword").value;
    const users = readJSON(STORAGE.users, []);
    if (authMode === "register") {
      if (name.length < 2) return showAuthMessage("Enter your full name.");
      if (password.length < 6) return showAuthMessage("Password must contain at least 6 characters.");
      if (users.some(user => user.email === email)) return showAuthMessage("An account with this email already exists.");
      // Demo only: passwords are stored locally for demonstration and are not securely hashed.
      const user = { name, email, password };
      users.push(user);
      localStorage.setItem(STORAGE.users, JSON.stringify(users));
      currentUser = { name, email };
      localStorage.setItem(STORAGE.currentUser, JSON.stringify(currentUser));
      updateAccountUI();
      closeAuth();
      addNotification("Welcome to KATSVTAP", `Your demo account is ready, ${name}. Select a bus stop to view approaching vehicles.`);
      return;
    }
    const user = users.find(item => item.email === email && item.password === password);
    if (!user) return showAuthMessage("Email or password is incorrect. Create a demo account if you have not registered.");
    currentUser = { name: user.name, email: user.email };
    localStorage.setItem(STORAGE.currentUser, JSON.stringify(currentUser));
    updateAccountUI();
    closeAuth();
  }
  function showAuthMessage(message, success = false) {
    $("#authMessage").textContent = message;
    $("#authMessage").classList.toggle("success", success);
  }
  function signOut() {
    currentUser = null;
    localStorage.removeItem(STORAGE.currentUser);
    updateAccountUI();
  }
  function useCurrentLocation() {
    const message = $("#locationMessage");
    if (!navigator.geolocation) {
      message.textContent = "Your browser does not support location access. Please select a bus stop.";
      return;
    }
    message.textContent = "Requesting your location permission…";
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      let nearest = busStops.map(stop => ({ ...stop, distance: distanceKm(latitude, longitude, stop.lat, stop.lng) }))
        .sort((a, b) => a.distance - b.distance)[0];
      setSelectedStop(nearest.id);
      message.textContent = `Nearest registered stop to your current location: ${nearest.name} (${nearest.distance.toFixed(1)} km straight-line distance).`;
    }, () => {
      message.textContent = "Location permission was unavailable. Select a bus stop manually.";
    }, { enableHighAccuracy: true, timeout: 10000 });
  }
  function simulateMovement() {
    // Tiny coordinate changes are for demonstrating refreshed estimates only, not real GPS movement.
    vehicles = vehicles.map(vehicle => {
      if (!vehicle.active || vehicle.heading !== "towards") return vehicle;
      const target = getStop(selectedStopId);
      const dLat = target.lat - vehicle.lat;
      const dLng = target.lng - vehicle.lng;
      const norm = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
      return { ...vehicle, lat: vehicle.lat + (dLat / norm) * 0.00008, lng: vehicle.lng + (dLng / norm) * 0.00008 };
    });
    renderNearest();
  }

  $$(".nav-link, [data-view]").forEach(button => {
    button.addEventListener("click", event => {
      const view = event.currentTarget.dataset.view;
      if (view) showView(view);
    });
  });
  $("#mobileMenuBtn").addEventListener("click", () => $("#topNav").classList.toggle("open"));
  $("#busStopSelect").addEventListener("change", event => setSelectedStop(event.target.value));
  $("#nearbyStopSelect").addEventListener("change", event => { selectedStopId = event.target.value; renderAllVehicles(); });
  $("#mapStopSelect").addEventListener("change", event => { selectedStopId = event.target.value; renderMaps(); });
  $("#findVehicleBtn").addEventListener("click", () => {
    setSelectedStop($("#busStopSelect").value);
    showView("home");
    $("#nearestVehicleCard").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("#sortVehicles").addEventListener("change", renderAllVehicles);
  $("#useLocationBtn").addEventListener("click", useCurrentLocation);
  $("#authButton").addEventListener("click", () => currentUser ? signOut() : openAuth("login"));
  $("#closeAuthModal").addEventListener("click", closeAuth);
  $("#authModal").addEventListener("click", event => { if (event.target === $("#authModal")) closeAuth(); });
  $$(".auth-tab").forEach(tab => tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode)));
  $("#authForm").addEventListener("submit", handleAuthSubmit);
  $("#clearNotificationsBtn").addEventListener("click", () => {
    notifications = [];
    localStorage.setItem(STORAGE.notifications, JSON.stringify(notifications));
    renderNotifications();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeAuth(); });

  populateStopSelects();
  updateAccountUI();
  renderNotifications();
  renderNearest();
  // Refresh the demo display periodically. This does not connect to real vehicles.
  window.setInterval(simulateMovement, 15000);
})();
