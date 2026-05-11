const map = L.map('map').setView(JSON.parse(atob("Wy01LjY1LCAxMzIuODVd")), 10);

const satelliteLayer = L.tileLayer(atob("aHR0cHM6Ly9zZXJ2ZXIuYXJjZ2lzb25saW5lLmNvbS9BcmNHSVMvcmVzdC9zZXJ2aWNlcy9Xb3JsZF9JbWFnZXJ5L01hcFNlcnZlci90aWxlL3t6fS97eX0ve3h9"), {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19
});

const cartoVoyager = L.tileLayer(atob("aHR0cHM6Ly97c30uYmFzZW1hcHMuY2FydG9jZG4uY29tL3Jhc3RlcnRpbGVzL3ZveWFnZXIve3p9L3t4fS97eX17cn0ucG5n"), {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &amp; CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
});

cartoVoyager.addTo(map);
const baseMaps = {
    "🛰 <b>Esri </b>Satellite": satelliteLayer,
    "🗺️ <b>CartoDB </b>Voyager": cartoVoyager
};
L.control.layers(baseMaps, null, { position: atob("dG9wcmlnaHQ=") }).addTo(map);

let markers = {};
let currentPolyline = null;
let currentMultiPolyline = null;
let tempCircle = null;
let currentMultiPoints = [];
let userMarker = null;

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getInfoLokasi(lokasi) {
    const keiKecil = locations.find(l => l.name === "01 Kei Kecil");
    if (!keiKecil) return null;
    
    const jarak = calculateDistance(lokasi.lat, lokasi.lng, keiKecil.lat, keiKecil.lng);
    const isSeberangLaut = lokasi.isSeberangLaut === true;
    
    return { jarak, isSeberangLaut };
}

function cleanNamaLokasi(nama) {
    let cleaned = nama.replace(/^\d{2}\s/, '');
    cleaned = cleaned.replace(/^\d{6}\s/, '');
    return cleaned;
}

const hargaBBM = {
    pertamax: 13000,
    status: 'belum dimuat',
    lastUpdate: null
};

async function ambilHargaPertamax() {
    const url = 'https://script.google.com/macros/s/AKfycbyW6Drww6KLBDJ7iPf-PwpPV3RC5vvagw-efmIBBVk2iUiPiIkcnsoa1UlABh62jJqz/exec';
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const pertamaxData = data.find(item => item.PRODUK === "PERTAMAX");
        
        if (pertamaxData && pertamaxData.HARGA > 0) {
            hargaBBM.pertamax = pertamaxData.HARGA;
            hargaBBM.lastUpdate = pertamaxData.DATETIME;
            hargaBBM.status = 'berhasil';
            console.log(`✅ Harga Pertamax: Rp ${hargaBBM.pertamax.toLocaleString('id-ID')}/liter (update: ${hargaBBM.lastUpdate})`);
        } else {
            hargaBBM.pertamax = 13000;
            hargaBBM.status = 'fallback';
            console.warn('⚠️ Data PERTAMAX tidak ditemukan, menggunakan harga default Rp 13.000');
        }
        return hargaBBM.pertamax;
    } catch (error) {
        console.error('❌ Gagal mengambil harga BBM:', error);
        hargaBBM.pertamax = 13000;
        hargaBBM.status = 'error';
        return 13000;
    }
}

function hitungBiayaTidakSeberang(jarakKm) {
    let hargaAsli = 20000;
    if (hargaBBM && typeof hargaBBM.pertamax === 'number' && hargaBBM.pertamax > 0) {
        hargaAsli = hargaBBM.pertamax;
    }
    
    const hargaDasar = Math.floor(hargaAsli / 1000) * 1000;
    let jarakBulat = Math.ceil(jarakKm);
    
    const aturan = JSON.parse(atob("W1syLDAuMjUsMC41XSxbNSwwLjUsMV0sWzksMC43NSwxLjVdLFsxMSwxLjI1LDJdLFsxNCwxLjUsMi41XSxbMTgsMS43NSwzXSxbMjAsMi4yNSwzLjVdLFsyMywyLjUsNF0sWzI3LDIuNzUsNC41XSxbMjksMy4yNSw1XSxbMzIsMy41LDUuNV1d"));
    
    let persen = 3.75;
    let multiplier = 6.00;
    
    for (let i = 0; i < aturan.length; i++) {
        if (jarakBulat <= aturan[i][0]) {
            persen = aturan[i][1];
            multiplier = aturan[i][2];
            break;
        }
    }
    
    let total = Math.round(hargaDasar * (1 + persen) * multiplier * 2);
    
    if (persen === 0.25) {
        total = total * 2;
    }    
    
    return Math.ceil(total / 5000) * 5000;
}

function hitungBiayaSeberang(jarakKm, hargaAsli) {
    let harga = 20000;
    
    if (typeof hargaAsli === 'number' && hargaAsli > 0) {
        harga = hargaAsli;
    } else if (hargaBBM && typeof hargaBBM.pertamax === 'number' && hargaBBM.pertamax > 0) {
        harga = hargaBBM.pertamax;
    }
    
    const jarak = (typeof jarakKm === 'number' && jarakKm > 0) ? jarakKm : 0;
    if (jarak === 0) return 0;
    
    const langkah1 = Math.ceil(harga / 1000) * 1000;
    const dengan11Persen = langkah1 + (langkah1 * 0.11);
    const hargaPerKm = Math.ceil(dengan11Persen / 500) * 500;
    
    let total = hargaPerKm * jarak * 2;
    
    total = Math.floor(total / 5000) * 5000;
    
    return total;
}

function hitungBiayaBBM(jarakKm, hargaAsli, isSeberangLaut = false) {
    if (isSeberangLaut === true) {
        return hitungBiayaSeberang(jarakKm, hargaAsli);
    } else {
        return hitungBiayaTidakSeberang(jarakKm);
    }
}

async function initMarkers() {
    await ambilHargaPertamax();
    
    const infoCache = new Map();
    locations.forEach(loc => {
        if (loc.name !== "01 Kei Kecil") {
            const info = getInfoLokasi(loc);
            if (info) {
                infoCache.set(loc.name, info);
            }
        }
    });
    
    locations.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lng]).addTo(map);
        
        const namaBersih = cleanNamaLokasi(loc.name).toUpperCase();
        
        let jarakText = "";
        let biayaText = "";
        
        if (loc.name !== "01 Kei Kecil") {
            const info = infoCache.get(loc.name);
            if (info) {
                jarakText = ` • ${info.jarak.toFixed(0)} Km`;
                
                const biaya = hitungBiayaBBM(info.jarak, hargaBBM.pertamax, info.isSeberangLaut);
                if (biaya > 0) {
                    const iconSeberang = info.isSeberangLaut ? " 🚢" : " 🚙";
                    biayaText = `<br>🎫 Estimasi${iconSeberang}⇌ <strong>Rp ${biaya.toLocaleString('id-ID')}</strong>`;
                }
            }
        } else {
            jarakText = ` - KPU`;
        }
        
        marker.bindPopup(`
            <b>${namaBersih}${jarakText}</b><br>
            📍 ${loc.lat.toFixed(5)}°, ${loc.lng.toFixed(5)}°${biayaText}<br>
            <a href="${loc.url}" target="_blank" style="color:#2c7da0; text-decoration:none;">🌐 Buka Google Maps</a>
        `);
        markers[loc.name] = marker;
    });
}

function renderLocationList(filterText = "") {
    const container = document.getElementById("coordList");
    const filtered = locations.filter(loc => 
        loc.name.toLowerCase().includes(filterText.toLowerCase())
    );
    document.getElementById("statsInfo").innerHTML = `📌 Menampilkan ${filtered.length} dari ${locations.length} lokasi`;
    
    if(filtered.length === 0) {
        container.innerHTML = "<div style='padding:30px;text-align:center'>❌ Lokasi tidak ditemukan</div>";
        return;
    }
    
    container.innerHTML = "";
    filtered.forEach(loc => {
        const div = document.createElement("div");
        div.className = "coord-item";
        div.innerHTML = `
            <div class="coord-info">
                <div class="coord-name">${loc.name}</div>
                <div class="coord-latlng">${loc.lat.toFixed(5)}°, ${loc.lng.toFixed(5)}°</div>
            </div>
            <div class="coord-actions">
                <button class="url-btn" data-url="${loc.url}">
                    <i class="fas fa-external-link-alt"></i> Maps
                </button>
            </div>
        `;

        div.querySelector(".coord-info").addEventListener("click", (e) => {
            e.stopPropagation();
            focusOnLocation(loc.name);
        });
        
        div.querySelector(".url-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            window.open(e.currentTarget.getAttribute('data-url'), '_blank');
        });
        
        container.appendChild(div);
    });
}

function focusOnLocation(name) {
    const marker = markers[name];
    if(marker) {
        map.setView(marker.getLatLng(), 14);
        marker.openPopup();
        if(tempCircle) map.removeLayer(tempCircle);
        tempCircle = L.circle(marker.getLatLng(), {radius: 300, color: '#ff7800', weight: 2, opacity: 0.6, fillOpacity: 0.15}).addTo(map);
        setTimeout(() => { if(tempCircle) map.removeLayer(tempCircle); }, 2000);
    } else {
        alert(`Lokasi "${name}" tidak ditemukan`);
    }
}

function addGeocoder() {
    L.Control.geocoder({
        defaultMarkGeocode: false,
        position: 'topleft',
        placeholder: 'Cari lokasi lain...'
    }).on('markgeocode', function(e) {
        const bbox = e.geocode.bbox;
        map.fitBounds(bbox);
        L.popup().setLatLng(e.geocode.center).setContent(e.geocode.name).openOn(map);
    }).addTo(map);
}

function resetCalculationResult() {
    document.getElementById("distanceResult").innerHTML = "📍 Pilih titik/lokasi awal dan tujuan, lalu tekan \"Kalkulasi\"";
    if (currentMultiPolyline) {
        map.removeLayer(currentMultiPolyline);
        currentMultiPolyline = null;
    }
    if (currentPolyline) {
        map.removeLayer(currentPolyline);
        currentPolyline = null;
    }
}

function getAllPoints() {
    const startName = document.getElementById("startPointSelect").value;
    if (!startName) return [];
    
    const startLoc = locations.find(l => l.name === startName);
    if (!startLoc) return [];
    
    const points = [startLoc];
    
    const endName = document.getElementById("endPointSelect").value;
    if (endName) {
        const endLoc = locations.find(l => l.name === endName);
        if (endLoc) points.push(endLoc);
    }
    
    currentMultiPoints.forEach(point => {
        if (point) points.push(point);
    });
    
    return points;
}

function updateAddButtonState() {
    const startSelected = document.getElementById("startPointSelect").value;
    const endSelected = document.getElementById("endPointSelect").value;
    const totalPoints = 1 + (endSelected ? 1 : 0) + currentMultiPoints.length;
    const addBtn = document.getElementById("addWaypointBtn");
    
    if (addBtn) {
        addBtn.disabled = !(startSelected && endSelected && totalPoints < 10);
    }
}

function renderExtraWaypoints() {
    const container = document.getElementById("extraWaypointsContainer");
    if (!container) return;
    container.innerHTML = "";
    
    currentMultiPoints.forEach((point, index) => {
        const div = document.createElement("div");
        div.className = "waypoint-item";
        div.innerHTML = `
            <select class="extra-waypoint" data-index="${index}" style="flex:2;">
                <option value="">-- Pilih Tujuan ${index + 2} --</option>
            </select>
            <button class="remove-waypoint" data-index="${index}" title="Hapus titik tujuan">✖</button>
        `;
        container.appendChild(div);
        
        const select = div.querySelector('.extra-waypoint');
        locations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.name;
            option.textContent = `${loc.name} (${loc.lat.toFixed(4)}°, ${loc.lng.toFixed(4)}°)`;
            if (loc.name === point.name) option.selected = true;
            select.appendChild(option);
        });
        
        select.addEventListener('change', (e) => {
            const newLoc = locations.find(l => l.name === e.target.value);
            if (newLoc) {
                currentMultiPoints[index] = newLoc;
            }
            resetCalculationResult();
            populateDistanceDropdowns();
            updateAddButtonState();
        });
        
        div.querySelector('.remove-waypoint').addEventListener('click', () => {
            const distanceResult = document.getElementById("distanceResult").innerHTML;
            const isDefaultMessage = distanceResult === "📍 Pilih titik/lokasi awal dan tujuan, lalu tekan \"Kalkulasi\"";
            
            if (!isDefaultMessage) {
                if (confirm('⚠️ Menghapus titik tujuan akan menghapus hasil perhitungan jarak sebelumnya. Lanjutkan?')) {
                    currentMultiPoints.splice(index, 1);
                    renderExtraWaypoints();
                    resetCalculationResult();
                    populateDistanceDropdowns();
                    updateAddButtonState();
                }
            } else {
                currentMultiPoints.splice(index, 1);
                renderExtraWaypoints();
                populateDistanceDropdowns();
                updateAddButtonState();
            }
        });
    });
    
    updateAddButtonState();
}

function addWaypoint() {
    const startSelected = document.getElementById("startPointSelect").value;
    const endSelected = document.getElementById("endPointSelect").value;
    const totalPoints = 1 + (endSelected ? 1 : 0) + currentMultiPoints.length;
    
    if (!startSelected || !endSelected) {
        alert('⚠️ Silakan pilih titik awal dan tujuan terlebih dahulu.');
        return;
    }
    
    if (totalPoints >= 10) {
        alert('⚠️ Maksimal 10 titik dalam satu rute (1 awal + 9 tujuan).');
        return;
    }
    
    const existingNames = getAllPoints().map(p => p.name);
    let defaultLoc = locations.find(l => !existingNames.includes(l.name));
    if (!defaultLoc && locations.length > 0) defaultLoc = locations[0];
    
    if (defaultLoc) {
        currentMultiPoints.push(defaultLoc);
    } else {
        alert('Tidak ada lokasi tersedia untuk ditambahkan');
        return;
    }
    
    renderExtraWaypoints();
    populateDistanceDropdowns();
    resetCalculationResult();
    updateAddButtonState();
}

function populateDistanceDropdowns() {
    const startSel = document.getElementById("startPointSelect");
    const endSel = document.getElementById("endPointSelect");
    if (!startSel || !endSel) return;
    
    const existingNames = getAllPoints().map(p => p.name);
    const startValue = startSel.value;
    const endValue = endSel.value;
    
    startSel.innerHTML = '<option value="">-- Pilih Lokasi Awal --</option>';
    endSel.innerHTML = '<option value="">-- Pilih Lokasi Tujuan --</option>';
    
    locations.forEach(loc => {
        if (!existingNames.includes(loc.name) || loc.name === startValue) {
            const opt1 = document.createElement("option");
            opt1.value = loc.name;
            opt1.textContent = `${loc.name}`;
            if (loc.name === startValue) opt1.selected = true;
            startSel.appendChild(opt1);
        }
        
        if (!existingNames.includes(loc.name) || loc.name === endValue) {
            const opt2 = document.createElement("option");
            opt2.value = loc.name;
            opt2.textContent = `${loc.name}`;
            if (loc.name === endValue) opt2.selected = true;
            endSel.appendChild(opt2);
        }
    });
    
    updateAddButtonState();
}

function formatJarak(jarakKm) {
    if (jarakKm <= 0) return "0";
    
    if (jarakKm < 0.5) {
        return "± 1";
    }
    
    const bulat = Math.round(jarakKm);
    
    if (jarakKm < 1 && jarakKm >= 0.5) {
        return "± 1";
    }
    
    return bulat;
}

function calculateAndShowDistance() {
    const allPoints = getAllPoints();
    
    if (allPoints.length < 2) {
        document.getElementById("distanceResult").innerHTML = "⚠️ Silakan pilih minimal 2 titik (awal dan minimal 1 tujuan)";
        return;
    }
    
    for (let i = 0; i < allPoints.length - 1; i++) {
        if (allPoints[i].name === allPoints[i+1].name) {
            document.getElementById("distanceResult").innerHTML = `⚠️ Duplikasi berurutan: "${allPoints[i].name}" muncul dua kali berturut-turut.`;
            if (currentMultiPolyline) map.removeLayer(currentMultiPolyline);
            currentMultiPolyline = null;
            return;
        }
    }
    
    let totalJarak = 0;
    const segments = [];
    const allLatLngs = [];
    
    for (let i = 0; i < allPoints.length - 1; i++) {
        const a = allPoints[i];
        const b = allPoints[i+1];
        const jarak = calculateDistance(a.lat, a.lng, b.lat, b.lng);
        totalJarak += jarak;
        segments.push({ dari: a.name, ke: b.name, jarak: jarak });
        if (i === 0) allLatLngs.push([a.lat, a.lng]);
        allLatLngs.push([b.lat, b.lng]);
    }
    
    const totalFormat = formatJarak(totalJarak);
    
    let resultHtml = `🛣 <strong>TOTAL JARAK: ${totalFormat} km</strong><br>`;
    resultHtml += `📍 ${segments.length} ruas | 🚩 ${allPoints.length} titik<br><br>`;
    resultHtml += '<strong>📝 RINCIAN PER SEGMEN:</strong><br>';
    
    segments.forEach((seg, idx) => {
        const segFormat = formatJarak(seg.jarak);
        resultHtml += `<div class="segment-item">${idx+1}. ${seg.dari} ➜ ${seg.ke} : <strong>${segFormat} km</strong></div>`;
    });
    
    document.getElementById("distanceResult").innerHTML = resultHtml;
    
    if (currentMultiPolyline) map.removeLayer(currentMultiPolyline);
    if (allLatLngs.length >= 2) {
        currentMultiPolyline = L.polyline(allLatLngs, { color: '#e34234', weight: 4, opacity: 0.8, dashArray: '5, 8' }).addTo(map);
        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds.pad(0.2));
    }
}

function openDriveRoute() {
    const allPoints = getAllPoints();
    
    if (allPoints.length < 2) {
        alert("⚠️ Minimal pilih 2 titik untuk membuka rute di Google Maps");
        return;
    }
    
    let url = 'https://www.google.com/maps/dir/';
    allPoints.forEach((wp, idx) => {
        url += `${wp.lat},${wp.lng}`;
        if (idx < allPoints.length - 1) url += '/';
    });
    window.open(url, '_blank');
}

function resetMapView() {
    currentMultiPoints = [];
    renderExtraWaypoints();
    
    document.getElementById("startPointSelect").value = "";
    document.getElementById("endPointSelect").value = "";
    
    document.getElementById("distanceResult").innerHTML = "📍 Pilih titik/lokasi awal dan tujuan, lalu tekan \"Kalkulasi\"";
    
    if (currentMultiPolyline) map.removeLayer(currentMultiPolyline);
    if (currentPolyline) map.removeLayer(currentPolyline);
    if (tempCircle) map.removeLayer(tempCircle);
    
    currentMultiPolyline = null;
    currentPolyline = null;
    
    for(let key in markers) {
        markers[key].closePopup();
    }
    
    const allLatLngs = locations.map(loc => [loc.lat, loc.lng]);
    const bounds = L.latLngBounds(allLatLngs);
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
    
    let padding = 0.15;
    if (isMobile) padding = 0.2;
    else if (isTablet) padding = 0.18;
    else padding = 0.15;
    map.fitBounds(bounds.pad(padding));

    populateDistanceDropdowns();
    updateAddButtonState();
}

function scrollToDistancePanel() {
    document.querySelector(".distance-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function toDMS(deg, isLat) {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

  const direction = deg >= 0 
    ? (isLat ? "N" : "E") 
    : (isLat ? "S" : "W");

  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

const latDMS = toDMS(latitude, true);
const lngDMS = toDMS(longitude, false);

function locateUser() {
    if (!navigator.geolocation) {
        alert("Browser tidak mendukung deteksi lokasi.");
        return;
    }
    
    const btn = document.getElementById("locateUserBtn");
    const originalIcon = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>';
    btn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 15);
            
            if (userMarker) {
                map.removeLayer(userMarker);
            }
            
            userMarker = L.marker([latitude, longitude]).addTo(map);
            userMarker.bindPopup(`<a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">${(function(deg,isLat){const abs=Math.abs(deg);const d=Math.floor(abs);const mNot=(abs-d)*60;const m=Math.floor(mNot);const s=Math.floor((mNot-m)*60);const dir=deg>=0?(isLat?"N":"E"):(isLat?"S":"W");return d+"°"+m+"'"+s+'"'+dir;})(latitude,true)}, ${(function(deg,isLat){const abs=Math.abs(deg);const d=Math.floor(abs);const mNot=(abs-d)*60;const m=Math.floor(mNot);const s=Math.floor((mNot-m)*60);const dir=deg>=0?(isLat?"N":"E"):(isLat?"S":"W");return d+"°"+m+"'"+s+'"'+dir;})(longitude,false)}</a>`).openPopup();
            
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        },
        (error) => {
            let pesan = "";
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    pesan = "⚠️ Akses lokasi ditolak. Ubah manual pengaturan browser.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    pesan = "⚠️ Lokasi tidak tersedia. Pastikan GPS perangkat aktif.";
                    break;
                case error.TIMEOUT:
                    pesan = "⚠️ Waktu permintaan lokasi habis. Silakan dicoba lagi.";
                    break;
                default:
                    pesan = "⚠️ " + error.message;
            }
            alert(pesan);
            
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        },
        { enableHighAccuracy: false, timeout: 13000, maximumAge: 60000 }
    );
}