// OpenRouteService API Key
const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjM3ZmFlNzhlNjk2ZTQxNjc5YzIxODNhZTcxM2Y5NWViIiwiaCI6Im11cm11cjY0In0=";

// 1. Setup Map
const map = L.map('map', { zoomControl: true }).setView([22.5937, 78.9629], 5);

// Use OpenStreetMap tile server (Free & Keyless, avoids CartoDB 'API KEY REQUIRED' tile block)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

setTimeout(() => { map.invalidateSize(); }, 500);

let routeLayerGroup = L.layerGroup().addTo(map);

// 2. Add Markers to Map
jyotirlingas.forEach(t => {
    L.circleMarker([t.lat, t.lng], {
        radius: 8, fillColor: "#ea580c", color: "#fff", weight: 3, fillOpacity: 1
    }).addTo(map).bindPopup(`
        <div style="text-align:center; padding: 4px; width: 180px;">
            <img src="${t.image}" style="width:100%; height:90px; object-fit:cover; object-position:center; border-radius:8px; margin-bottom:8px; display:block;" alt="${t.name}">
            <h4 style="margin:0 0 4px 0; font-family:'Plus Jakarta Sans', sans-serif; font-size:16px; font-weight:800; color:#0f172a;">${t.name}</h4>
            <p style="margin:0 0 10px 0; font-size:12px; color:#64748b; font-family:'Plus Jakarta Sans', sans-serif;">${t.city}, ${t.state}</p>
            <a href="temple.html?id=${t.id}" style="display:inline-block; background:#ea580c; color:#fff; text-decoration:none; padding:6px 16px; border-radius:99px; font-weight:bold; font-size:13px; font-family:'Plus Jakarta Sans', sans-serif;">View Details</a>
        </div>
    `);
});

// 3. Populate Gallery
const gridContainer = document.getElementById('temple-grid');
if(gridContainer) {
    jyotirlingas.forEach(t => {
        gridContainer.innerHTML += `
            <a href="temple.html?id=${t.id}" class="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden hover:-translate-y-1">
                <div class="h-48 w-full overflow-hidden bg-slate-100">
                    <img src="${t.image}" alt="${t.name}" class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="p-5">
                    <h4 class="font-extrabold text-xl text-slate-800 mb-1">${t.name}</h4>
                    <p class="text-sm text-slate-500 font-semibold uppercase tracking-wider">${t.state}</p>
                </div>
            </a>
        `;
    });
}

// 4. Routing Logic
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Fetch road route geometry from OpenRouteService API with automatic fallback
async function getRoadRoute(p1, p2) {
    try {
        const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${API_KEY}&start=${p1[1]},${p1[0]}&end=${p2[1]},${p2[0]}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('ORS API Error');
        const data = await res.json();
        const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        const distanceKm = data.features[0].properties.summary.distance / 1000;
        return { coords, distanceKm };
    } catch (err) {
        // Fallback to straight line if API request fails or is rate-limited
        const distanceKm = getDistance(p1[0], p1[1], p2[0], p2[1]);
        return { coords: [p1, p2], distanceKm };
    }
}

document.getElementById('generateBtn').onclick = () => {
    const count = parseInt(document.getElementById('templeCount').value);
    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    btn.innerText = "Calculating Route...";

    navigator.geolocation.getCurrentPosition(async pos => {
        try {
            const user = [pos.coords.latitude, pos.coords.longitude];
            
            routeLayerGroup.clearLayers();
            map.flyTo(user, 5);
            L.marker(user).addTo(routeLayerGroup).bindPopup("<b>Your Location</b>").openPopup();

            let sorted = [...jyotirlingas].sort((a,b) => getDistance(user[0], user[1], a.lat, a.lng) - getDistance(user[0], user[1], b.lat, b.lng)).slice(0, count);
            let waypoints = [user, ...sorted.map(t => [t.lat, t.lng])];
            let totalDist = 0;

            for(let i = 0; i < waypoints.length - 1; i++) {
                let p1 = waypoints[i];
                let p2 = waypoints[i+1];
                
                const routeData = await getRoadRoute(p1, p2);
                totalDist += routeData.distanceKm;

                L.polyline(routeData.coords, { color: '#ea580c', weight: 4, opacity: 0.8 }).addTo(routeLayerGroup);

                let midLat = (p1[0] + p2[0]) / 2;
                let midLng = (p1[1] + p2[1]) / 2;
                let segmentDist = Math.round(routeData.distanceKm);

                let distanceLabel = L.divIcon({
                    className: 'custom-map-label',
                    html: `<div style="background: #ffffff; padding: 2px 8px; border-radius: 12px; font-weight: 800; color: #ea580c; border: 2px solid #ea580c; font-size: 11px; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">${segmentDist} KM</div>`,
                    iconSize: [null, null], iconAnchor: [30, 10]
                });
                L.marker([midLat, midLng], {icon: distanceLabel}).addTo(routeLayerGroup);
            }

            document.getElementById('distanceDisplay').innerHTML = `🚗 Total Route: <span class="text-orange-600">${Math.round(totalDist)} KM</span>`;
            document.getElementById('distanceDisplay').classList.remove('hidden');
        } catch(e) {
            console.error("Routing error:", e);
        } finally {
            btn.disabled = false;
            btn.innerText = "Generate Route";
        }
    }, () => { 
        alert("Please allow location access to calculate the route."); 
        btn.disabled = false;
        btn.innerText = "Generate Route";
    });
};